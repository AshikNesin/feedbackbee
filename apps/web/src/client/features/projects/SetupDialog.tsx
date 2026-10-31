import { Code } from "lucide-react";
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
import { Text } from "@groot/ui/typography";
import type { ProjectDTO } from "../../../server/wire-types";
import { CopyBlock } from "../../components/CopyBlock";

/** The queue stub lets pages call FeedbackBee.open() before embed.js has loaded. */
const STUB =
  '<script>window.FeedbackBee=window.FeedbackBee||{q:[]};"init ready identify setContext open close on off reset".split(" ").map(function(m){window.FeedbackBee[m]=function(){var a=[].slice.call(arguments);return new Promise(function(r,j){window.FeedbackBee.q.push([m,a,r,j])})}})</script>';

/** Install snippets for the web widget and the Android SDK. */
export function SetupDialog({
  project,
  defaultOpen,
}: {
  project: ProjectDTO;
  defaultOpen?: boolean;
}) {
  const origin = window.location.origin;
  const web = `${STUB}\n<script src="${origin}/embed.js" data-project="${project.slug}" async></script>`;
  const android = `FeedbackBee.init(this, projectId = "${project.slug}", endpoint = "${origin}")`;
  return (
    <Dialog defaultOpen={defaultOpen}>
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
        <DialogBody className="space-y-6">
          <section className="space-y-2">
            <h3>
              <Text variant="title">Web</Text>
            </h3>
            <p>
              <Text tone="muted">
                Paste before the closing <code>&lt;/body&gt;</code> tag. Add{" "}
                <code>data-headless</code> to hide the pill and open it from your own UI with{" "}
                <code>FeedbackBee.open()</code>.
              </Text>
            </p>
            <CopyBlock code={web} />
          </section>
          <section className="space-y-2">
            <h3>
              <Text variant="title">Android</Text>
            </h3>
            <p>
              <Text tone="muted">
                Call from <code>Application.onCreate</code>, then <code>FeedbackBee.open()</code> or
                shake to report.
              </Text>
            </p>
            <CopyBlock code={android} />
          </section>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
