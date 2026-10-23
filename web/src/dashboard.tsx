import { useEffect, useMemo, useState } from "react";
import { api, type Feedback, type Project } from "./api.ts";

function snippet(origin: string, slug: string) {
  return `<script src="${origin}/embed.js" data-project="${slug}" async></script>`;
}

function SnippetBox({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const code = snippet(location.origin, slug);
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <pre className="snippet">{code}</pre>
      <button
        className="ghost"
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
    <div className="item">
      <div className="row">
        <span className={`tag ${KIND_CLASS[f.kind] ?? ""}`}>{f.kind === "feedback" ? "other" : f.kind}</span>
        <span className="muted">{new Date(f.created_at).toLocaleString()}</span>
        {f.device_model && <span className="muted">{f.device_model}</span>}
        {f.state === "created" && f.issue_url ? (
          <a href={f.issue_url} target="_blank" rel="noreferrer">#{f.issue_number}</a>
        ) : f.state === "issue_error" ? (
          <span className="tag err">issue failed</span>
        ) : f.state === "pending" ? (
          <span className="tag err">pending</span>
        ) : null}
      </div>
      <div>{f.text}</div>
      <div className="row">
        {f.media_key && (f.media_key.endsWith(".rrweb.gz")
          ? <a href={`/replay/${f.media_key}`} target="_blank" rel="noreferrer">watch replay</a>
          : <a href={`/f/${f.media_key}`} target="_blank" rel="noreferrer">view {f.media_kind}</a>)}
        {f.reporter_email && <span className="muted">{f.reporter_email}</span>}
      </div>
      {f.state === "issue_error" && f.issue_error && (
        <div className="muted" style={{ color: "#b45309" }} title={f.issue_error}>
          Issue creation failed ({f.issue_error.split(":")[0]}). Stored as pending.
        </div>
      )}
    </div>
  );
}

function NewProjectForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [repo, setRepo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createProject({ name, slug, github_repo: repo });
      setName(""); setSlug(""); setRepo("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
      <div className="row">
        <label style={{ flex: 1 }}>Name
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="My app" />
        </label>
        <label style={{ flex: 1 }}>Project id
          <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} required placeholder="myapp" minLength={3} maxLength={40} />
        </label>
      </div>
      <div className="row">
        <label style={{ flex: 1 }}>GitHub repo
          <input value={repo} onChange={(e) => setRepo(e.target.value)} required placeholder="owner/repo" />
        </label>
      </div>
      {error && <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div>}
      <div className="row" style={{ justifyContent: "space-between" }}>
        <button style={{ justifySelf: "start" }} disabled={busy}>{busy ? "Creating…" : "Add project"}</button>
        <span className="muted">Issues are created with the deployment&apos;s GitHub token.</span>
      </div>
    </form>
  );
}

export function Dashboard() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback[] | null>(null);

  const refresh = () => api.projects().then(setProjects).catch(() => setProjects([]));

  useEffect(() => { refresh(); }, []);

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
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
        <h1>FeedbackBee</h1>
        <button className="ghost" onClick={api.logout}>Sign out</button>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>Feedback lands as GitHub issues.</p>

      <div style={{ display: "grid", gap: 28, marginTop: 28 }}>
        <section className="card">
          <NewProjectForm onCreated={refresh} />
        </section>

        <section>
          <h2>Projects</h2>
          {projects.length === 0 && <p className="muted" style={{ margin: 0 }}>None yet. Add your first above.</p>}
          <div className="row">
            {projects.map((p) => (
              <button
                key={p.id}
                className={selected === p.id ? "" : "ghost"}
                onClick={() => setSelected(selected === p.id ? null : p.id)}
              >
                {p.slug}
              </button>
            ))}
          </div>
        </section>

        {current && (
          <section style={{ display: "grid", gap: 20 }}>
            <div className="card" style={{ display: "grid", gap: 12 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{current.name}</strong>
                <button className="danger" onClick={() => remove(current.id)}>Delete</button>
              </div>
              <div className="muted">
                Issues go to <a href={`https://github.com/${current.github_repo}`} target="_blank" rel="noreferrer">{current.github_repo}</a>
              </div>
              <SnippetBox slug={current.slug} />
            </div>

            <section>
              <h2>Feedback</h2>
              {feedback === null && <p className="muted" style={{ margin: 0 }}>Loading…</p>}
              {feedback !== null && feedback.length === 0 && <p className="muted" style={{ margin: 0 }}>Nothing yet.</p>}
              <div className="list">
                {feedback?.map((f) => <FeedbackRow key={f.id} f={f} />)}
              </div>
            </section>
          </section>
        )}
      </div>
    </div>
  );
}
