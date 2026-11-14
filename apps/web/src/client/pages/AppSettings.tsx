import { BellRing, GitBranch } from "lucide-react";
import {
  DEFAULT_SETTINGS_SECTIONS,
  Settings,
  type SettingsSection,
} from "@groot/shell/pages/settings/Settings";
import { GithubSettings } from "../features/github/GithubSettings";
import { NotificationSettings } from "../features/notifications/NotificationSettings";

/** FeedbackBee's own sections first, then groot's account, appearance, security and configuration. */
const SECTIONS: SettingsSection[] = [
  {
    id: "github",
    label: "GitHub",
    group: "FeedbackBee",
    icon: GitBranch,
    description:
      "Connect FeedbackBee to GitHub and choose which repositories can receive feedback.",
    keywords: ["github app", "repository", "repo", "install", "webhook"],
    items: [{ label: "GitHub connection" }, { label: "Repositories" }],
    element: <GithubSettings />,
  },
  {
    id: "notifications",
    label: "Push notifications",
    group: "FeedbackBee",
    icon: BellRing,
    description: "Get a Pushover notification on your phone when feedback arrives.",
    keywords: ["pushover", "push", "notify", "alert", "phone", "quiet hours"],
    items: [
      { label: "When", keywords: ["events", "quiet hours"] },
      { label: "Which feedback", keywords: ["kinds", "projects"] },
      { label: "What", keywords: ["reporter", "text", "device"] },
      { label: "Priority" },
      { label: "Send test notification" },
    ],
    element: <NotificationSettings />,
  },
  ...DEFAULT_SETTINGS_SECTIONS,
];

export function AppSettings() {
  return <Settings sections={SECTIONS} />;
}
