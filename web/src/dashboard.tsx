import { useEffect, useMemo, useState } from "react";
import { api, type Feedback, type Project } from "./api.ts";

function snippet(origin: string, slug: string) {
  return `<script src="${origin}/embed.js" data-project="${slug}" async></script>`;
}

function SnippetBox({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const code = snippet(location.origin, slug);
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <pre className="snippet">{code}</pre>
      <button
        className="secondary"
        style={{ justifySelf: "start" }}
        onClick={async () => {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied" : "Copy snippet"}
      </button>
    </div>
  );
}

const KIND_CLASS: Record<string, string> = { bug: "bug", idea: "idea", feedback: "" };

function FeedbackRow({ f }: { f: Feedback }) {
  return (
    <div className="card item">
      <div className="row">
        <span className={`tag ${KIND_CLASS[f.kind] ?? ""}`}>{f.kind}</span>
        <span className="muted">{new Date(f.created_at).toLocaleString()}</span>
        {f.device_model && <span className="muted">{f.device_model}</span>}
        {f.state === "created" && f.issue_url && (
          <a href={f.issue_url} target="_blank" rel="noreferrer">
            #{f.issue_number}
          </a>
        )}
        {f.state === "issue_error" && <span className="tag err">issue failed</span>}
        {f.state === "pending" && <span className="tag err">pending</span>}
      </div>
      <div>{f.text}</div>
      <div className="row">
        {f.media_key && f.media_kind === "screenshot" && (
          <a href={`/f/${f.media_key}`} target="_blank" rel="noreferrer">
            view screenshot
          </a>
        )}
        {f.media_key && f.media_kind === "recording" && (
          <a href={`/f/${f.media_key}`} target="_blank" rel="noreferrer">
            view recording
          </a>
        )}
        {f.reporter_email && <span className="muted">{f.reporter_email}</span>}
      </div>
      {f.state === "issue_error" && f.issue_error && (
        <div className="muted" style={{ color: "#b45309" }}>{f.issue_error}</div>
      )}
    </div>
  );
}

function NewProjectForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [repo, setRepo] = useState("");
  const [pat, setPat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createProject({ name, slug, github_repo: repo, github_pat: pat });
      setName(""); setSlug(""); setRepo(""); setPat("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit} style={{ display: "grid", gap: 10 }}>
      <h2 style={{ margin: 0, fontSize: 16 }}>New project</h2>
      <div className="row">
        <label style={{ flex: 1 }}>Name<input value={name} onChange={(e) => setName(e.target.value)} required placeholder="My App" /></label>
        <label style={{ flex: 1 }}>Slug<input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} required placeholder="myapp" pattern="[a-z0-9][a-z0-9-]*" /></label>
      </div>
      <label>GitHub repo (owner/repo)<input value={repo} onChange={(e) => setRepo(e.target.value)} required placeholder="ashik/myapp" /></label>
      <label>GitHub PAT (kept encrypted, never shown again)<input value={pat} onChange={(e) => setPat(e.target.value)} required type="password" placeholder="ghp_…" /></label>
      {error && <div style={{ color: "#dc2626", fontSize: 13 }}>{error}</div>}
      <button style={{ justifySelf: "start" }} disabled={busy}>{busy ? "Creating…" : "Create project"}</button>
      <span className="muted">PAT needs repo issues write. Labels bug/enhancement/feedback are used by default.</span>
    </form>
  );
}

export function Dashboard() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback[] | null>(null);

  const refresh = () => api.projects().then(setProjects).catch(() => setProjects([]));

  useEffect(() => {
    refresh();
  }, []);

  const current = useMemo(() => projects?.find((p) => p.id === selected) ?? null, [projects, selected]);

  useEffect(() => {
    if (!selected) return setFeedback(null);
    setFeedback(null);
    api.feedback(selected).then(setFeedback).catch(() => setFeedback([]));
  }, [selected]);

  async function remove(id: string) {
    if (!confirm("Delete this project and all its feedback?")) return;
    await api.deleteProject(id);
    if (selected === id) setSelected(null);
    refresh();
  }

  if (projects === null) return <div className="app muted">Loading…</div>;

  return (
    <div className="app">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 24 }}>
        <h1>FeedbackBee</h1>
        <button className="secondary" onClick={api.logout}>Sign out</button>
      </div>

      <NewProjectForm onCreated={refresh} />

      <h2 style={{ fontSize: 16, margin: "28px 0 12px" }}>Projects</h2>
      {projects.length === 0 && <div className="muted">No projects yet. Create one above.</div>}
      <div className="row" style={{ gap: 10 }}>
        {projects.map((p) => (
          <button
            key={p.id}
            className={selected === p.id ? "" : "secondary"}
            onClick={() => setSelected(selected === p.id ? null : p.id)}
          >
            {p.name} <span style={{ opacity: 0.7 }}>({p.slug})</span>
          </button>
        ))}
      </div>

      {current && (
        <div style={{ display: "grid", gap: 16, marginTop: 24 }}>
          <div className="card" style={{ display: "grid", gap: 10 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{current.name}</strong>
              <button className="danger" onClick={() => remove(current.id)}>Delete project</button>
            </div>
            <div className="muted">
              Issues go to <a href={`https://github.com/${current.github_repo}`} target="_blank" rel="noreferrer">{current.github_repo}</a> with labels bug / enhancement / feedback.
            </div>
            <SnippetBox slug={current.slug} />
          </div>

          <h2 style={{ fontSize: 16, margin: 0 }}>Feedback</h2>
          {feedback === null && <div className="muted">Loading…</div>}
          {feedback !== null && feedback.length === 0 && <div className="muted">Nothing yet. Try the widget!</div>}
          <div className="list">
            {feedback?.map((f) => <FeedbackRow key={f.id} f={f} />)}
          </div>
        </div>
      )}
    </div>
  );
}
