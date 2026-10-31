import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@groot/ui/button";
import { cn } from "@groot/ui/lib/utils";
import { monoClass } from "@groot/ui/typography";
import { tokenize, type CodeLang } from "../lib/highlight";

/**
 * A read-only, highlighted code block with a copy button (the 404less
 * CodeBlock). Long lines scroll sideways instead of breaking mid-word; `wrap`
 * (for prose, like the agent prompt) wraps them at word boundaries instead.
 */
export function CodeBlock({
  code,
  lang,
  label = "Copy",
  wrap = false,
  className,
}: {
  code: string;
  lang: CodeLang;
  label?: string;
  wrap?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      className={cn("code-block relative rounded-xl border border-border bg-muted/60", className)}
    >
      <pre
        className={cn(
          monoClass,
          "px-4 py-3 pr-12 leading-relaxed",
          wrap ? "whitespace-pre-wrap break-words" : "overflow-x-auto",
        )}
      >
        <code>{tokenize(code, lang)}</code>
      </pre>
      <Button
        variant="outline"
        size="icon-xs"
        aria-label={copied ? "Copied" : label}
        title={label}
        className="absolute top-2 right-2 bg-card"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
          } catch {
            return; // clipboard blocked: don't claim it was copied
          }
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="text-success" /> : <Copy />}
      </Button>
    </div>
  );
}
