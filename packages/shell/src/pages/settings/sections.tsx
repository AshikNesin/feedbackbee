import type { ReactNode } from "react";
import { FileJson, Palette, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { AccountSettings } from "@groot/shell/components/AccountSettings";
import { AppSettings } from "@groot/shell/components/AppSettings";
import { PasskeyManager } from "@groot/shell/components/PasskeyManager";
import { ThemeSettings } from "@groot/shell/components/ThemeSettings";

/** One searchable setting inside a section (it links to its section). */
export interface SettingsItem {
  label: string;
  description?: string;
  keywords?: string[];
}

/** One sidebar entry and sub-route of the settings page (`/settings/:id`). */
export interface SettingsSection {
  /** URL segment, e.g. `appearance` for `/settings/appearance`. */
  id: string;
  label: string;
  /** Sidebar group heading; sections with the same group are listed together. */
  group: string;
  icon?: LucideIcon;
  /** Shown under the section title and in search results. */
  description?: string;
  /** Extra search terms, e.g. `dark` for Appearance. */
  keywords?: string[];
  items?: SettingsItem[];
  element: ReactNode;
  /** Use the wider content column (master/detail editors). */
  wide?: boolean;
}

export const DEFAULT_SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "account",
    label: "Account",
    group: "Personal",
    icon: UserRound,
    description: "Your profile and sign-in identity.",
    keywords: ["profile", "user", "me"],
    items: [{ label: "Name" }, { label: "Email" }, { label: "User ID" }],
    element: <AccountSettings />,
  },
  {
    id: "appearance",
    label: "Appearance",
    group: "Personal",
    icon: Palette,
    description: "Customize how the app looks.",
    keywords: ["theme", "dark", "light", "system", "color", "mode"],
    items: [
      {
        label: "Theme",
        description: "Light, dark or system",
        keywords: ["dark mode", "light mode"],
      },
    ],
    element: <ThemeSettings />,
  },
  {
    id: "security",
    label: "Security",
    group: "Personal",
    icon: ShieldCheck,
    description: "Passkeys for passwordless sign-in.",
    keywords: [
      "passkey",
      "webauthn",
      "face id",
      "touch id",
      "security key",
      "biometric",
      "sign in",
      "login",
    ],
    items: [{ label: "Add a passkey" }, { label: "Your passkeys", keywords: ["rename", "delete"] }],
    element: <PasskeyManager />,
  },
  {
    id: "configuration",
    label: "Configuration",
    group: "App",
    icon: FileJson,
    description: "App-wide settings, shared by every user.",
    keywords: ["app settings", "json", "config", "key", "value", "feature flags"],
    items: [{ label: "App settings" }, { label: "Add setting" }],
    element: <AppSettings />,
    wide: true,
  },
];
