import { useEffect, useRef, useState } from "react";
import { api, type Feedback, type Project } from "./api.ts";
import { Icon, Logo, ThemeToggle } from "./icons.tsx";

type Kind = Feedback["kind"];
const KINDS: { id: Kind | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "bug", label: "Issues" },
  { id: "idea", label: "Ideas" },
  { id: "feedback", label: "Other" },
];

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
function ago(ms: number) {
  const s = Math.round((ms - Date.now()) / 1000);
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [[60, "second"], [60, "minute"], [24, "hour"], [7, "day"], [4.35, "week"], [12, "month"]];
  let v = s;
  for (const [size, unit] of steps) {
    if (Math.abs(v) < size) return unit === "second" ? "just now" : rtf.format(Math.round(v), unit);
    v /= size;
  }
  return rtf.format(Math.round(v), "year");
}

function clock(seconds: number | null) {
  const s = Math.max(0, Math.round(seconds ?? 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function pagePath(url: string | null) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.host + (u.pathname === "/" ? "" : u.pathname);
  } catch {
    return url;
  }
}

function browser(ua: string | null) {
  if (!ua) return null;
  const name = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : null;
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : null;
  return [name, os].filter(Boolean).join(" on ") || null;
}

const isReplay = (key: string | null) => !!key && key.endsWith(".rrweb.gz");

function lastProject() {
  try { return localStorage.getItem("fb:project") ?? ""; } catch { return ""; }
}

function useHashProject(projects: Project[] | null) {
  const [slug, setSlug] = useState(() => decodeURIComponent(location.hash.slice(1)) || lastProject());
  useEffect(() => {
    const on = () => setSlug(decodeURIComponent(location.hash.slice(1)));
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  const current = projects?.find((p) => p.slug === slug) ?? projects?.[0] ?? null;
  useEffect(() => {
    if (!current) return;
    try { localStorage.setItem("fb:project", current.slug); } catch { /* storage unavailable */ }
  }, [current?.slug]);
  const select = (s: string) => { location.hash = encodeURIComponent(s); };
  return [current, select] as const;
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn quiet"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      <Icon name={done ? "check" : "copy"} /> {done ? "Copied" : label}
    </button>
  );
}

function Setup({ project, onDeleted }: { project: Project; onDeleted: () => void }) {
  const web = `<script src="${location.origin}/embed.js" data-project="${project.slug}" async></script>`;
  const android = `FeedbackBee.init(this, projectId = "${project.slug}", endpoint = "${location.origin}")`;
  return (
    <div className="setup">
      <div>
        <h2>Web</h2>
        <p>Paste before the closing <code>&lt;/body&gt;</code> tag.</p>
        <div className="code"><pre>{web}</pre><CopyButton text={web} /></div>
      </div>
      <div>
        <h2>Android</h2>
        <p>Call from <code>Application.onCreate</code>, then <code>FeedbackBee.show()</code> or shake to report.</p>
        <div className="code"><pre>{android}</pre><CopyButton text={android} /></div>
      </div>
      <div className="setup-foot">
        <p>Issues are filed in <a href={`https://github.com/${project.github_repo}`} target="_blank" rel="noreferrer">{project.github_repo}</a> with the deployment&apos;s GitHub token.</p>
        <button
          type="button"
          className="btn quiet danger"
          onClick={async () => {
            if (!confirm(`Delete ${project.name} and all of its feedback? GitHub issues stay.`)) return;
            await api.deleteProject(project.id);
            onDeleted();
          }}
        >
          Delete project
        </button>
      </div>
    </div>
  );
}

function FeedbackItem({ f, open, onToggle }: { f: Feedback; open: boolean; onToggle: () => void }) {
  const shot = f.media_kind === "screenshot" && f.media_key ? `/f/${f.media_key}` : null;
  const replay = isReplay(f.media_key);
  const video = f.media_kind === "recording" && f.media_key && !replay ? `/f/${f.media_key}` : null;
  const where = pagePath(f.url);
  const device = f.device_model || browser(f.user_agent);
  return (
    <div className={`item${open ? " open" : ""}`}>
      <button type="button" className="row" aria-expanded={open} onClick={onToggle}>
        <span className={`dot ${f.kind}`} title={f.kind === "bug" ? "Issue" : f.kind === "idea" ? "Idea" : "Other"} />
        <span className="text">
          <p>{f.text || <em style={{ color: "var(--faint)" }}>No message</em>}</p>
          <span className="meta">
            <span title={new Date(f.created_at).toLocaleString()}>{ago(f.created_at)}</span>
            {where && <span>{where}</span>}
            {device && <span>{device}</span>}
            {f.reporter_email && <span>{f.reporter_email}</span>}
          </span>
        </span>
        <span className="right">
          {replay && <span className="chip"><Icon name="play" />{clock(f.media_seconds)}</span>}
          {video && <span className="chip"><Icon name="play" />{clock(f.media_seconds)}</span>}
          {f.audio_key && <span className="chip"><Icon name="mic" />{clock(f.audio_seconds)}</span>}
          {shot && <img className="thumb" src={shot} alt="" loading="lazy" />}
          {f.state === "created" && f.issue_number ? (
            <span className="chip">#{f.issue_number}</span>
          ) : f.state === "issue_error" ? (
            <span className="chip warn">Not filed</span>
          ) : f.state === "pending" ? (
            <span className="chip warn">Pending</span>
          ) : null}
        </span>
      </button>
      {open && (
        <div className="detail">
          {shot && <a className="media" href={shot} target="_blank" rel="noreferrer"><img src={shot} alt="Screenshot" /></a>}
          {video && <video className="media" src={video} controls preload="metadata" style={{ width: "100%" }} />}
          {f.audio_key && <audio src={`/f/${f.audio_key}`} controls preload="none" />}
          <div className="actions">
            {f.issue_url && <a className="btn" href={f.issue_url} target="_blank" rel="noreferrer"><Icon name="github" /> Issue #{f.issue_number}</a>}
            {replay && <a className="btn" href={`/replay/${f.media_key}`} target="_blank" rel="noreferrer"><Icon name="play" /> Watch replay</a>}
            {f.reporter_email && <a className="btn" href={`mailto:${f.reporter_email}`}><Icon name="mail" /> Reply</a>}
          </div>
          {f.state === "issue_error" && f.issue_error && (
            <p className="error" style={{ color: "var(--warn)" }}>Couldn&apos;t create the GitHub issue: {f.issue_error}</p>
          )}
          <dl className="ctx">
            {f.url && <><dt>Page</dt><dd><a href={f.url} target="_blank" rel="noreferrer">{f.url}</a></dd></>}
            <dt>Sent</dt><dd>{new Date(f.created_at).toLocaleString()}</dd>
            {f.os_name === "web"
              ? browser(f.user_agent) && <><dt>Browser</dt><dd>{browser(f.user_agent)}</dd></>
              : f.os_name && <><dt>OS</dt><dd>{[f.os_name, f.os_version].filter(Boolean).join(" ")}</dd></>}
            {f.device_model && <><dt>Device</dt><dd>{f.device_model}</dd></>}
            {f.app_version && <><dt>App version</dt><dd>{f.app_version}</dd></>}
            {f.screen_w && f.screen_h && <><dt>Screen</dt><dd>{f.screen_w}×{f.screen_h}</dd></>}
            {f.user_agent && <><dt>User agent</dt><dd>{f.user_agent}</dd></>}
          </dl>
        </div>
      )}
    </div>
  );
}

function Inbox({ project, setupOpen }: { project: Project; setupOpen: (open: boolean) => void }) {
  const [items, setItems] = useState<Feedback[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [kind, setKind] = useState<Kind | "all">("all");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setItems(null);
    setOpen(null);
    setKind("all");
    api.feedback(project.id).then(
      (page) => {
        if (!live) return;
        setItems(page.feedback);
        setHasMore(page.hasMore);
        if (page.feedback.length === 0) setupOpen(true);
      },
      () => live && setItems([]),
    );
    return () => { live = false; };
  }, [project.id]);

  async function more() {
    if (!items?.length) return;
    setLoadingMore(true);
    try {
      const page = await api.feedback(project.id, items[items.length - 1]!.created_at);
      setItems([...items, ...page.feedback]);
      setHasMore(page.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }

  if (items === null) return <div className="list" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="skeleton" />)}</div>;

  if (items.length === 0) {
    return (
      <div className="empty">
        <Icon name="inbox" size={22} />
        <h3>No feedback yet</h3>
        <p>Add the snippet above to your app. New feedback shows up here and in GitHub.</p>
      </div>
    );
  }

  const count = (k: Kind) => items.filter((f) => f.kind === k).length;
  const shown = kind === "all" ? items : items.filter((f) => f.kind === kind);
  return (
    <>
      <div className="bar">
        <div className="seg" role="group" aria-label="Filter by type">
          {KINDS.map((k) => (
            <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
              {k.label}
              {!hasMore && <span className="n">{k.id === "all" ? items.length : count(k.id)}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="list">
        {shown.map((f) => (
          <FeedbackItem key={f.id} f={f} open={open === f.id} onToggle={() => setOpen(open === f.id ? null : f.id)} />
        ))}
      </div>
      {shown.length === 0 && <div className="empty"><p>Nothing here{hasMore ? " yet. Load more to look further back" : ""}.</p></div>}
      {hasMore && (
        <div className="more">
          <button type="button" className="btn" disabled={loadingMore} onClick={more}>{loadingMore ? "Loading…" : "Load more"}</button>
        </div>
      )}
    </>
  );
}

function NewProject({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (p: Project) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [repo, setRepo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setName(""); setSlug(""); setSlugEdited(false); setRepo(""); setError(null);
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open]);

  const toSlug = (v: string) => v.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+/, "").slice(0, 40);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const p = await api.createProject({ name: name.trim(), slug: slug.replace(/-+$/, ""), github_repo: repo.trim() });
      onCreated(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the project");
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => { if (e.target === ref.current) onClose(); }} aria-labelledby="np-title">
      <form className="dialog" onSubmit={submit}>
        <h2 id="np-title">New project</h2>
        <p className="sub">Feedback from this project becomes issues in one GitHub repo.</p>
        <label className="field">Name
          <input className="input" value={name} required autoFocus placeholder="My app"
            onChange={(e) => { setName(e.target.value); if (!slugEdited) setSlug(toSlug(e.target.value)); }} />
        </label>
        <label className="field">Project id <small>Used in the embed snippet</small>
          <input className="input" value={slug} required minLength={3} maxLength={40} placeholder="my-app" pattern="[a-z0-9][a-z0-9-]*"
            onChange={(e) => { setSlug(toSlug(e.target.value)); setSlugEdited(true); }} />
        </label>
        <label className="field">GitHub repo
          <input className="input" value={repo} required placeholder="owner/repo" pattern="[\w.-]+/[\w.-]+" autoCapitalize="off" spellCheck={false}
            onChange={(e) => setRepo(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="dialog-foot">
          <button type="button" className="btn quiet" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? "Creating…" : "Create project"}</button>
        </div>
      </form>
    </dialog>
  );
}

export function Dashboard() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [setup, setSetup] = useState(false);
  const [current, select] = useHashProject(projects);

  const refresh = () => api.projects().then(setProjects).catch(() => setProjects([]));
  useEffect(() => { refresh(); }, []);
  useEffect(() => { setSetup(false); }, [current?.id]);

  if (projects === null) return <div className="loading">Loading…</div>;

  const dialog = (
    <NewProject
      open={creating}
      onClose={() => setCreating(false)}
      onCreated={(p) => { setCreating(false); refresh().then(() => select(p.slug)); }}
    />
  );

  if (!current) {
    return (
      <div className="auth">
        <div className="auth-theme"><ThemeToggle /></div>
        <div className="empty" style={{ padding: 0 }}>
          <Logo size={32} />
          <h3>Create your first project</h3>
          <p>A project connects your app&apos;s widget to a GitHub repo.</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 20 }}>
            <button className="btn primary" onClick={() => setCreating(true)}><Icon name="plus" /> New project</button>
            <button className="btn quiet" onClick={api.logout}>Sign out</button>
          </div>
        </div>
        {dialog}
      </div>
    );
  }

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><Logo /> FeedbackBee</div>
        <div className="side-label">
          Projects
          <button className="btn quiet icon" aria-label="New project" title="New project" onClick={() => setCreating(true)}><Icon name="plus" /></button>
        </div>
        <nav aria-label="Projects">
          {projects.map((p) => (
            <button key={p.id} type="button" className="proj" aria-current={p.id === current.id} onClick={() => select(p.slug)}>
              <span className="avatar" aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</span>
              <span>{p.name}</span>
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <div className="side-actions">
            <ThemeToggle className="btn quiet icon" />
            <button type="button" className="proj" onClick={api.logout}><Icon name="logout" /> <span>Sign out</span></button>
          </div>
        </div>
      </aside>

      <div>
        <div className="mobile-top">
          <Logo />
          <select className="input" aria-label="Project" value={current.slug} onChange={(e) => select(e.target.value)}>
            {projects.map((p) => <option key={p.id} value={p.slug}>{p.name}</option>)}
          </select>
          <button className="btn icon" aria-label="New project" onClick={() => setCreating(true)}><Icon name="plus" /></button>
          <ThemeToggle />
          <button className="btn icon quiet" aria-label="Sign out" onClick={api.logout}><Icon name="logout" /></button>
        </div>

        <main className="main">
          <div className="top">
            <div>
              <h1>{current.name}</h1>
              <p>
                <code>{current.slug}</code> · issues go to{" "}
                <a href={`https://github.com/${current.github_repo}`} target="_blank" rel="noreferrer">{current.github_repo}</a>
              </p>
            </div>
            <div className="top-actions">
              <button type="button" className="btn" aria-expanded={setup} onClick={() => setSetup(!setup)}>
                <Icon name="code" /> {setup ? "Hide setup" : "Setup"}
              </button>
            </div>
          </div>
          {setup && <Setup project={current} onDeleted={() => { location.hash = ""; refresh(); }} />}
          <Inbox key={current.id} project={current} setupOpen={setSetup} />
        </main>
      </div>
      {dialog}
    </div>
  );
}
