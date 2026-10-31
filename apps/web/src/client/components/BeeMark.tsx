import { forwardRef, type SVGProps } from "react";
import type { LucideIcon } from "lucide-react";

/**
 * The FeedbackBee mark (the website's logo and favicon): a honey hexagon with
 * an ink speech bubble. Drawn for the shell's brand slot, which renders it
 * inside an ink tile, like an app icon.
 */
const Mark = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(function BeeMark(props, ref) {
  return (
    <svg ref={ref} viewBox="0 0 32 32" aria-hidden="true" {...props}>
      <path
        d="M16 2.8 27.4 9.4v13.2L16 29.2 4.6 22.6V9.4z"
        fill="var(--honey)"
        stroke="var(--honey)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M11 12.5h10a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5h-4.2L14 22.6v-2.1h-3A1.5 1.5 0 0 1 9.5 19v-5a1.5 1.5 0 0 1 1.5-1.5z"
        fill="var(--honey-foreground)"
      />
    </svg>
  );
});

/** `ShellBrand.icon` is typed for Lucide icons; the mark takes the same props it is given. */
export const BeeMark = Mark as unknown as LucideIcon;
