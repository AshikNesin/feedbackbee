/**
 * Test doubles for code that calls `AIClient`: pi-ai's faux provider, which
 * answers with scripted messages through the same `complete` / `stream` path
 * a real provider takes, so tool-call extraction, stop reasons, streaming and
 * reasoning options all run for real.
 *
 * ```ts
 * const faux = registerFauxProvider({ models: [{ id: "my-model" }] });
 * const ai = new AI({ provider: "faux", model: faux.getModel() });
 * faux.setResponses([fauxAssistantMessage(fauxToolCall("extract_data", { name: "Jo" }))]);
 * await ai.generateObject({ prompt: "…", schema });
 * faux.unregister();
 * ```
 *
 * A response step can be a function of `(context, options, state, model)`,
 * to check what the client sent.
 */
export {
  fauxAssistantMessage,
  fauxText,
  fauxThinking,
  fauxToolCall,
  registerFauxProvider,
  type FauxProviderRegistration,
  type FauxResponseStep,
  type RegisterFauxProviderOptions,
} from "@earendil-works/pi-ai/compat";
