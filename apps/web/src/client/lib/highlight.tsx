import type { ReactNode } from "react";

/**
 * A small syntax highlighter for the setup snippets: HTML (with inline
 * script), JavaScript / TypeScript, Kotlin / Gradle Kotlin DSL and Swift. Enough to read, no
 * dependency. Tokens get `tok-*` classes, coloured in styles.css.
 */
export type CodeLang = "html" | "js" | "ts" | "kotlin" | "swift" | "text";

type Rule = [RegExp, string | ((match: RegExpExecArray) => ReactNode[])];

const KEYWORDS = {
  js: "var|let|const|function|return|new|if|else|for|while|typeof|this|true|false|null|undefined",
  kotlin:
    "class|object|fun|val|var|override|super|this|return|import|package|true|false|null|if|else|when",
  swift:
    "import|try|let|var|func|class|struct|enum|if|else|return|true|false|nil|self|init|guard|in|for|while",
};

function codeRules(lang: "js" | "kotlin" | "swift"): Rule[] {
  return [
    [/\/\/[^\n]*/y, "com"],
    [/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/y, "str"],
    [new RegExp(`\\b(?:${KEYWORDS[lang]})\\b`, "y"), "kw"],
    [/\b\d+(?:\.\d+)?\b/y, "num"],
    // a named argument (Kotlin) before =, or an argument label (Swift) before :
    [/\b[A-Za-z_]\w*(?=\s*=(?!=))/y, lang === "kotlin" ? "attr" : "plain"],
    ...(lang === "swift" ? ([[/\b[A-Za-z_]\w*(?=:)/y, "attr"]] as Rule[]) : []),
    // a call: name followed by (
    [/\b[A-Za-z_]\w*(?=\s*\()/y, "fn"],
    // a type or object (capitalised identifier)
    [/\b[A-Z]\w*/y, "type"],
    [/[A-Za-z_$][\w$]*/y, "plain"],
    [/\s+/y, "plain"],
    [/./y, "punc"],
  ];
}

function htmlRules(): Rule[] {
  return [
    [/<!--[\s\S]*?-->/y, "com"],
    // <script> … </script>: the tag, then the body as JavaScript
    [
      /(<script)([^>]*)(>)([\s\S]*?)(<\/script>)/y,
      (m) => [
        ...tokenize(m[1]!, "html"),
        ...tokenize(m[2]!, "html"),
        span("punc", m[3]!),
        ...tokenize(m[4]!, "js"),
        span("tag", m[5]!),
      ],
    ],
    [/<\/?[A-Za-z][\w-]*/y, "tag"],
    [/\/?>/y, "tag"],
    [/[A-Za-z_:][\w:.-]*(?==)/y, "attr"],
    [/"[^"]*"|'[^']*'/y, "str"],
    [/[A-Za-z_:][\w:.-]*/y, "attr"],
    [/\s+/y, "plain"],
    [/./y, "punc"],
  ];
}

let key = 0;
function span(kind: string, text: string): ReactNode {
  return kind === "plain" ? (
    text
  ) : (
    <span key={key++} className={`tok-${kind}`}>
      {text}
    </span>
  );
}

export function tokenize(code: string, lang: CodeLang): ReactNode[] {
  if (lang === "text") return [code];
  const rules = lang === "html" ? htmlRules() : codeRules(lang === "ts" ? "js" : lang);
  const out: ReactNode[] = [];
  let i = 0;
  outer: while (i < code.length) {
    for (const [re, kind] of rules) {
      re.lastIndex = i;
      const m = re.exec(code);
      if (!m || m[0].length === 0) continue;
      if (typeof kind === "function") out.push(...kind(m));
      else out.push(span(kind, m[0]));
      i += m[0].length;
      continue outer;
    }
    out.push(code[i]);
    i += 1;
  }
  return out;
}
