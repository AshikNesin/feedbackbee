import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@groot/ui/button";
import { monoClass } from "@groot/ui/typography";
import { cn } from "@groot/ui/lib/utils";

/** A code snippet with a copy button. */
export function CopyBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative rounded-xl bg-muted">
      <pre className={cn(monoClass, "overflow-x-auto p-4 pr-24 whitespace-pre-wrap break-all")}>
        {code}
      </pre>
      <Button
        variant="outline"
        size="sm"
        className="absolute top-2.5 right-2.5"
        onClick={async () => {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
