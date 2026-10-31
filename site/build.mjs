// Assembles the website: site/layout.html + site/pages/*.html → dist/client/,
// copies site/assets/* alongside (with _headers and _redirects), and writes
// sitemap.xml + robots.txt. Runs after the SPA build (`pnpm build:client` =
// vp build && this): the SPA's index.html becomes app.html (the Worker serves
// it for /app/*), because the website's home page owns /index.html.
// Pages start with a <!--meta {json} --> block (path, title, description, og).
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname);
const OUT = path.resolve(ROOT, "..", "dist", "client");
const SITE_URL = (process.env.SITE_URL ?? "https://feedbackbee.nesin.io").replace(/\/$/, "");

const layout = fs.readFileSync(path.join(ROOT, "layout.html"), "utf8");
fs.mkdirSync(OUT, { recursive: true });

// the SPA shell: vp build emits dist/client/index.html; the Worker serves it as /app.html
const spaIndex = path.join(OUT, "index.html");
if (fs.existsSync(spaIndex) && fs.readFileSync(spaIndex, "utf8").includes('<div id="root">')) {
  fs.renameSync(spaIndex, path.join(OUT, "app.html"));
} else if (!fs.existsSync(path.join(OUT, "app.html"))) {
  console.warn("site: no SPA build in dist/client (run vp build first); /app will 404");
}

// assets (css, js, images, og, demo videos, _headers, _redirects) → dist/client/
fs.cpSync(path.join(ROOT, "assets"), OUT, { recursive: true });

const urls = [];
for (const file of fs
  .readdirSync(path.join(ROOT, "pages"))
  .filter((f) => f.endsWith(".html"))
  .sort()) {
  const src = fs.readFileSync(path.join(ROOT, "pages", file), "utf8");
  const m = src.match(/^<!--meta\s*([\s\S]*?)-->/);
  if (!m) throw new Error(`${file}: missing <!--meta--> block`);
  const meta = JSON.parse(m[1]);
  const content = src.slice(m[0].length).trim();
  const canonical = SITE_URL + (meta.path === "/" ? "/" : meta.path);
  const jsonld = JSON.stringify(
    meta.path === "/"
      ? {
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "FeedbackBee",
          applicationCategory: "DeveloperApplication",
          operatingSystem: "Web, Android",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          description: meta.description,
          url: SITE_URL,
          license: "https://opensource.org/licenses/MIT",
          codeRepository: "https://github.com/AshikNesin/feedbackbee",
        }
      : {
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: meta.title,
          description: meta.description,
          url: canonical,
        },
  );
  const html = layout
    .replaceAll("{{title}}", esc(meta.title))
    .replaceAll("{{description}}", esc(meta.description))
    .replaceAll("{{ogDescription}}", esc(meta.ogDescription ?? meta.description))
    .replaceAll("{{canonical}}", canonical)
    .replaceAll("{{ogImage}}", SITE_URL + meta.og)
    .replace("{{jsonld}}", () => jsonld)
    .replace(
      '<link rel="canonical"',
      (meta.noindex ? '<meta name="robots" content="noindex" />\n    ' : "") +
        '<link rel="canonical"',
    )
    .replace("{{content}}", () => content);
  const outName = meta.path === "/" ? "index.html" : `${meta.path.replace(/^\//, "")}.html`;
  fs.writeFileSync(path.join(OUT, outName), html);
  if (!meta.noindex) urls.push(canonical);
  console.log("site:", meta.path, "→", outName);
}

fs.writeFileSync(
  path.join(OUT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`,
);
fs.writeFileSync(
  path.join(OUT, "robots.txt"),
  `User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /api\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
);

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
