import type { ReactNode } from "react";
import { Code, Globe, Smartphone, Sparkles, type LucideIcon } from "lucide-react";
import { Button } from "@groot/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@groot/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@groot/ui/tabs";
import { Text, monoClass } from "@groot/ui/typography";
import type { ProjectDTO } from "../../../server/wire-types";
import { CodeBlock } from "../../components/CodeBlock";
import type { CodeLang } from "../../lib/highlight";

/** The queue stub: lets a page call FeedbackBee.open() before embed.js has loaded. */
const STUB = `<script>
  window.FeedbackBee = window.FeedbackBee || { q: [] };
  "init ready identify setContext open close on off reset"
    .split(" ")
    .map(function (m) {
      window.FeedbackBee[m] = function () {
        var a = [].slice.call(arguments);
        return new Promise(function (r, j) {
          window.FeedbackBee.q.push([m, a, r, j]);
        });
      };
    });
</script>`;

interface Step {
  text: ReactNode;
  code?: { source: string; lang: CodeLang };
}

const Mono = ({ children }: { children: ReactNode }) => (
  <code className={monoClass}>{children}</code>
);

function webSteps(project: ProjectDTO, origin: string): Step[] {
  return [
    {
      text: (
        <>
          Paste before the closing <Mono>&lt;/body&gt;</Mono> tag. A pill appears in the corner.
        </>
      ),
      code: {
        lang: "html",
        source: `<script\n  src="${origin}/embed.js"\n  data-project="${project.slug}"\n  async\n></script>`,
      },
    },
    {
      text: (
        <>
          Optional: to open it from your own button, add <Mono>data-headless</Mono> to hide the
          pill, and paste this stub above the script so <Mono>FeedbackBee.open()</Mono> works before
          it has loaded.
        </>
      ),
      code: { lang: "html", source: STUB },
    },
    { text: <>Send a test report: it shows up here and as an issue in {project.githubRepo}.</> },
  ];
}

function androidSteps(project: ProjectDTO, origin: string): Step[] {
  return [
    {
      text: (
        <>
          Add the SDK from a checkout of FeedbackBee (it is not on Maven yet). In{" "}
          <Mono>settings.gradle.kts</Mono> and <Mono>app/build.gradle.kts</Mono>:
        </>
      ),
      code: {
        lang: "kotlin",
        source: `// settings.gradle.kts
include(":feedbackbee-sdk")
project(":feedbackbee-sdk").projectDir =
    file("../feedbackbee/android/sdk")

// app/build.gradle.kts
dependencies {
    implementation(project(":feedbackbee-sdk"))
}`,
      },
    },
    {
      text: (
        <>
          Init it once in your <Mono>Application</Mono> class. Shake to report is on.
        </>
      ),
      code: {
        lang: "kotlin",
        source: `class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()
        FeedbackBee.init(
            this,
            projectId = "${project.slug}",
            endpoint = "${origin}",
        )
    }
}`,
      },
    },
    {
      text: <>Or open it from your own button:</>,
      code: { lang: "kotlin", source: "FeedbackBee.open()" },
    },
  ];
}

const DOCS = "https://github.com/AshikNesin/feedbackbee";

/**
 * A prompt for a coding agent (Claude Code, Cursor, …) that adds the widget to
 * the user's app on its own: what FeedbackBee is, the exact snippet with this
 * project's values, where it goes, and how to check it worked.
 */
export function agentPrompt(project: ProjectDTO, origin: string): string {
  const lines = [
    `Add the FeedbackBee feedback widget to this project. FeedbackBee lets users report a bug or idea with a note, screenshots, a screen recording or a voice note, and files each report as a GitHub issue in ${project.githubRepo}.`,
    "",
    "If this is a website or web app, load the widget on every page: add this tag once, just before the closing </body> tag of the shared layout or HTML template (for example index.html, a root layout or _document):",
    "",
    `<script src="${origin}/embed.js" data-project="${project.slug}" async></script>`,
    "",
    `If this is an Android app, follow ${DOCS}/blob/main/android/README.md: include the SDK, then in the Application class's onCreate call:`,
    "",
    `FeedbackBee.init(this, projectId = "${project.slug}", endpoint = "${origin}")`,
    "",
  ];
  if (project.allowedOrigins.length > 0) {
    lines.push(
      `This project only accepts reports from these sites: ${project.allowedOrigins.join(", ")}. If the app runs on another origin (including local development), tell me which one so I can add it.`,
      "",
    );
  }
  lines.push(
    "Don't change anything else. When you're done, tell me where you added it, then how to check it: open the app, click the feedback button in the corner (or shake the phone on Android) and send a test report. It should show up at " +
      `${origin}/app/projects/${project.slug}.`,
    "",
    `Docs: ${DOCS}#readme`,
  );
  return lines.join("\n");
}

/** Install steps for the web widget and the Android SDK, the project's values filled in. */
export function SetupDialog({ project }: { project: ProjectDTO }) {
  const origin = window.location.origin;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Code className="size-4" />
          Setup
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add FeedbackBee to {project.name}</DialogTitle>
          <DialogDescription>
            New feedback shows up here and as an issue in {project.githubRepo}.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Tabs defaultValue="web" className="gap-4">
            <TabsList variant="line" className="w-full justify-start gap-3 border-b border-border">
              <TabsTrigger value="web" className="flex-none">
                <Globe className="size-4" />
                Web
              </TabsTrigger>
              <TabsTrigger value="android" className="flex-none">
                <Smartphone className="size-4" />
                Android
              </TabsTrigger>
              <TabsTrigger value="prompt" className="flex-none">
                <Sparkles className="size-4" />
                AI prompt
              </TabsTrigger>
            </TabsList>
            <TabsContent value="web">
              <SetupSteps
                icon={Globe}
                title="Any website"
                kind="One script tag; extras load when someone uses them"
                steps={webSteps(project, origin)}
              />
            </TabsContent>
            <TabsContent value="android">
              <SetupSteps
                icon={Smartphone}
                title="Android app"
                kind="Kotlin SDK, minSdk 26"
                steps={androidSteps(project, origin)}
              />
            </TabsContent>
            <TabsContent value="prompt">
              <PromptPanel prompt={agentPrompt(project, origin)} />
            </TabsContent>
          </Tabs>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/** A framed list of numbered steps, each with its snippet (the 404less setup card). */
function SetupSteps({
  icon: Icon,
  title,
  kind,
  steps,
}: {
  icon: LucideIcon;
  title: string;
  kind: string;
  steps: Step[];
}) {
  return (
    <section aria-label={title} className="overflow-hidden rounded-2xl border border-border">
      <header className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-border bg-background">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p>
            <Text className="font-medium">{title}</Text>
          </p>
          <p>
            <Text variant="meta">{kind}</Text>
          </p>
        </div>
      </header>
      <ol className="space-y-4 p-4">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-honey text-honey-foreground">
              <Text variant="meta" className="font-semibold text-honey-foreground">
                {i + 1}
              </Text>
            </span>
            <div className="min-w-0 flex-1 space-y-2 pt-0.5">
              <p>
                <Text>{step.text}</Text>
              </p>
              {step.code && (
                <CodeBlock
                  code={step.code.source}
                  lang={step.code.lang}
                  label={`Copy step ${i + 1}`}
                />
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The agent prompt, in the snippets' code block, wrapped like prose. */
function PromptPanel({ prompt }: { prompt: string }) {
  return (
    <div className="space-y-3">
      <p>
        <Text tone="muted">
          Send this to your coding agent (Claude Code, Cursor, Copilot…). It adds the widget to your
          app and tells you how to check it.
        </Text>
      </p>
      <CodeBlock code={prompt} lang="text" label="Copy prompt" wrap />
    </div>
  );
}
