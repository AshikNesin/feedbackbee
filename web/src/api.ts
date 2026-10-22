export type Project = {
  id: string;
  name: string;
  slug: string;
  github_repo: string;
  labels: Record<string, string>;
  created_at: number;
};

export type Feedback = {
  id: string;
  kind: "bug" | "idea" | "feedback";
  text: string;
  reporter_email: string | null;
  url: string | null;
  media_kind: "none" | "screenshot" | "recording";
  media_key: string | null;
  issue_url: string | null;
  issue_number: number | null;
  state: "pending" | "created" | "issue_error" | "deleted";
  issue_error: string | null;
  device_model: string | null;
  os_name: string | null;
  created_at: number;
};

async function req(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (res.status === 401 && location.pathname !== "/login") {
    location.href = "/login";
    throw new Error("unauthorized");
  }
  return res;
}

export const api = {
  async login(email: string, password: string) {
    const res = await fetch("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: "login failed" }))).error);
  },
  async logout() {
    await fetch("/auth/logout", { method: "POST" });
    location.href = "/login";
  },
  async projects(): Promise<Project[]> {
    const res = await req("/api/projects");
    const data = (await res.json()) as { projects: Project[] };
    return data.projects;
  },
  async createProject(p: { name: string; slug: string; github_repo: string; github_pat: string }): Promise<Project> {
    const res = await req("/api/projects", { method: "POST", body: JSON.stringify(p) });
    if (!res.ok) throw new Error((await res.json()).error);
    return (await res.json()).project;
  },
  async deleteProject(id: string) {
    await req(`/api/projects/${id}`, { method: "DELETE" });
  },
  async feedback(projectId: string): Promise<Feedback[]> {
    const res = await req(`/api/projects/${projectId}/feedback`);
    return (await res.json()).feedback;
  },
};
