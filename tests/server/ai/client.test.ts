import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { z } from "zod";
import { AI, definePrompt, type Message, type PiAITool, type ThinkingLevel } from "@groot/ai";
import {
  fauxAssistantMessage,
  fauxText,
  fauxThinking,
  fauxToolCall,
  registerFauxProvider,
  type FauxProviderRegistration,
} from "@groot/ai/testing";

// Network-free tests: every case fails fast before any provider call.
describe("AIClient", () => {
  it("throws at construction for unknown catalog models", () => {
    expect(() => new AI({ provider: "openai", model: "nope-9000" })).toThrow(/Unknown model/);
  });

  it("withModel returns a client bound to the new model id", () => {
    const ai = new AI({ provider: "gw", model: "a", baseUrl: "https://example.com/v1" });
    expect(ai.withModel("b").model.id).toBe("b");
  });

  it("generateObject rejects non-object schemas before calling the provider", async () => {
    const ai = new AI({ provider: "gw", model: "a", baseUrl: "https://example.com/v1" });
    await expect(ai.generateObject({ prompt: "x", schema: z.string() })).rejects.toThrow(
      /ZodObject/,
    );
  });

  it("execute validates input before calling the provider", async () => {
    const prompt = definePrompt({
      name: "test",
      inputSchema: z.object({ q: z.string() }),
      outputSchema: z.object({ answer: z.string() }),
      getMessages: (input) => [{ role: "user", content: input.q }],
    });
    const ai = new AI({ provider: "gw", model: "a", baseUrl: "https://example.com/v1" });
    // @ts-expect-error intentionally invalid input
    await expect(ai.execute(prompt, { q: 42 })).rejects.toThrow();
  });
});

/**
 * Behaviour against scripted responses: pi-ai's faux provider answers through
 * the same complete/stream path a real provider takes. Model ids pick the
 * effort rules in packages/ai/src/capabilities.ts.
 */
describe("AIClient against a faux provider", () => {
  let faux: FauxProviderRegistration;
  /**
   * What the client sent, per call. Providers get a transcript: the system
   * prompt and tools ride on a leading system message.
   */
  let sent: Array<{
    model: string;
    systemPrompt?: string;
    tools: PiAITool[];
    messages: Message[];
    reasoning?: ThinkingLevel;
  }>;

  const person = z.object({ name: z.string(), age: z.number() });

  /** Script responses, recording what each call sent. */
  function respond(...messages: ReturnType<typeof fauxAssistantMessage>[]) {
    faux.setResponses(
      messages.map((message) => (transcript, options, _state, model) => {
        const [first, ...rest] = transcript.messages;
        const system = first?.role === "system" ? first : undefined;
        sent.push({
          model: model.id,
          systemPrompt: typeof system?.content === "string" ? system.content : undefined,
          tools: system?.toolsAdded ?? [],
          messages: (system ? rest : transcript.messages) as Message[],
          reasoning: options?.reasoning,
        });
        return message;
      }),
    );
  }

  const client = (id = "faux-1") => new AI({ provider: "faux", model: faux.getModel(id)! });

  beforeEach(() => {
    sent = [];
    faux = registerFauxProvider({
      models: [
        { id: "faux-1", reasoning: true },
        { id: "cline-pass/kimi-k3", reasoning: true },
        { id: "cline-pass/glm-5.2", reasoning: true },
        { id: "cline-pass/kimi-k2.6", reasoning: true },
      ],
    });
  });

  afterEach(() => {
    faux.unregister();
  });

  it("accepts an already-resolved model and keeps it for withModel", () => {
    const ai = client();
    expect(ai.model).toBe(faux.getModel("faux-1"));
    expect(ai.withModel("cline-pass/glm-5.2").model).toMatchObject({
      id: "cline-pass/glm-5.2",
      api: faux.api,
      provider: "faux",
    });
  });

  describe("complete", () => {
    it("joins the text blocks and leaves out thinking", async () => {
      respond(fauxAssistantMessage([fauxThinking("hmm"), fauxText("Bon"), fauxText("jour")]));
      expect(await client().complete({ prompt: "hello", systemPrompt: "Translate." })).toBe(
        "Bonjour",
      );
      expect(sent[0].systemPrompt).toBe("Translate.");
      expect(sent[0].messages).toMatchObject([{ role: "user", content: "hello" }]);
    });

    it("throws the provider's message when the response stopped on an error", async () => {
      respond(fauxAssistantMessage([], { stopReason: "error", errorMessage: "quota exceeded" }));
      await expect(client().complete("hi")).rejects.toThrow("quota exceeded");
    });

    it("names the stop reason when an aborted response carries no message", async () => {
      respond(fauxAssistantMessage([], { stopReason: "aborted" }));
      await expect(client().complete("hi")).rejects.toThrow("AI request aborted");
    });
  });

  describe("generateObject", () => {
    it("returns the tool call's arguments, validated, and offers the schema as the only tool", async () => {
      respond(
        fauxAssistantMessage([
          fauxText("Calling the tool."),
          fauxToolCall("extract_person", { name: "Jane", age: 28 }),
        ]),
      );
      const result = await client().generateObject({
        prompt: "Jane is 28.",
        schema: person,
        schemaName: "extract_person",
        schemaDescription: "A person",
      });
      expect(result).toEqual({ name: "Jane", age: 28 });
      expect(sent[0].tools.map((tool) => [tool.name, tool.description])).toEqual([
        ["extract_person", "A person"],
      ]);
      expect(sent[0].systemPrompt).toContain('"extract_person" tool');
    });

    it("takes the first tool call when there are several", async () => {
      respond(
        fauxAssistantMessage([
          fauxToolCall("extract_data", { name: "First", age: 1 }),
          fauxToolCall("extract_data", { name: "Second", age: 2 }),
        ]),
      );
      expect(await client().generateObject({ prompt: "x", schema: person })).toEqual({
        name: "First",
        age: 1,
      });
    });

    it("throws when the model answers in text instead of calling the tool", async () => {
      respond(fauxAssistantMessage("Jane is 28."));
      await expect(client().generateObject({ prompt: "x", schema: person })).rejects.toThrow(
        /did not return a tool call/,
      );
    });

    it("throws when the tool call's arguments fail the schema", async () => {
      respond(fauxAssistantMessage(fauxToolCall("extract_data", { name: "Jane", age: "old" })));
      await expect(client().generateObject({ prompt: "x", schema: person })).rejects.toThrow(
        /failed schema validation/,
      );
    });

    it("throws the provider's message on an error stop before looking for a tool call", async () => {
      respond(
        fauxAssistantMessage(fauxToolCall("extract_data", { name: "Jane", age: 28 }), {
          stopReason: "error",
          errorMessage: "context window exceeded",
        }),
      );
      await expect(client().generateObject({ prompt: "x", schema: person })).rejects.toThrow(
        "context window exceeded",
      );
    });
  });

  describe("stream", () => {
    it("yields the text as it arrives", async () => {
      const text = "The quick brown fox jumps over the lazy dog, twice over.";
      respond(fauxAssistantMessage([fauxThinking("plan"), fauxText(text)]));
      const chunks: string[] = [];
      for await (const chunk of client().stream("tell me")) chunks.push(chunk);
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.join("")).toBe(text);
    });

    it("throws the provider's message when the stream ends on an error", async () => {
      respond(fauxAssistantMessage([], { stopReason: "error", errorMessage: "upstream 502" }));
      const read = async () => {
        for await (const _ of client().stream("tell me"));
      };
      await expect(read()).rejects.toThrow("upstream 502");
    });

    it("throws when the provider has nothing to answer with", async () => {
      faux.setResponses([]);
      const read = async () => {
        for await (const _ of client().stream("tell me"));
      };
      await expect(read()).rejects.toThrow("No more faux responses queued");
    });
  });

  describe("execute", () => {
    const extractPerson = definePrompt({
      name: "extract-person",
      description: "Extract a person",
      inputSchema: z.object({ text: z.string() }),
      outputSchema: person,
      reasoning: "high",
      getMessages: (input) => [
        { role: "system", content: "Extract person data." },
        { role: "user", content: input.text },
      ],
    });

    it("sends the prompt's messages and tool, and returns the validated output", async () => {
      respond(fauxAssistantMessage(fauxToolCall("extract-person", { name: "Jane", age: 28 })));
      expect(await client().execute(extractPerson, { text: "Jane is 28." })).toEqual({
        name: "Jane",
        age: 28,
      });
      expect(sent[0].tools.map((tool) => tool.name)).toEqual(["extract-person"]);
      expect(sent[0].messages).toMatchObject([{ role: "user" }]);
      expect(sent[0].reasoning).toBe("high");
    });

    it("runs on another model of the same provider when asked", async () => {
      respond(fauxAssistantMessage(fauxToolCall("extract-person", { name: "Jane", age: 28 })));
      await client().execute(
        extractPerson,
        { text: "Jane is 28." },
        { model: "cline-pass/glm-5.2" },
      );
      expect(sent[0].model).toBe("cline-pass/glm-5.2");
    });
  });

  describe("reasoning", () => {
    const sentReasoning = async (model: string, reasoning?: ThinkingLevel) => {
      respond(fauxAssistantMessage("ok"));
      await client(model).complete({ prompt: "think", reasoning });
      return sent.at(-1)?.reasoning;
    };

    it("sends none when none is asked for", async () => {
      expect(await sentReasoning("cline-pass/kimi-k3")).toBeUndefined();
    });

    it("sends a level the model accepts as asked", async () => {
      expect(await sentReasoning("cline-pass/kimi-k3", "max")).toBe("max");
      expect(await sentReasoning("faux-1", "medium")).toBe("medium");
    });

    it("caps a level above the model's highest effort", async () => {
      expect(await sentReasoning("cline-pass/glm-5.2", "max")).toBe("xhigh");
      expect(await sentReasoning("faux-1", "xhigh")).toBe("high");
    });

    it("leaves the parameter out for a model without effort control", async () => {
      expect(await sentReasoning("cline-pass/kimi-k2.6", "high")).toBeUndefined();
    });

    it("applies the same cap when streaming", async () => {
      respond(fauxAssistantMessage("ok"));
      for await (const _ of client("cline-pass/glm-5.2").stream({ prompt: "x", reasoning: "max" }));
      expect(sent[0].reasoning).toBe("xhigh");
    });

    it("leaves the level to pi-ai for a model whose levels it knows", async () => {
      const model = { ...faux.getModel("faux-1")!, thinkingLevelMap: { xhigh: "xhigh" } };
      respond(fauxAssistantMessage("ok"));
      await new AI({ provider: "faux", model }).complete({ prompt: "x", reasoning: "xhigh" });
      expect(sent[0].reasoning).toBe("xhigh");
    });
  });
});
