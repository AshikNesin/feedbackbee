import { Settings } from "@groot/shell/pages/settings/Settings";
import { GithubSettings } from "../features/github/GithubSettings";

/** GitHub setup is app-owned; retain groot's general and security settings. */
export function AppSettings() {
  return (
    <div className="space-y-8">
      <GithubSettings />
      <Settings />
    </div>
  );
}
