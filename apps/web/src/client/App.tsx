import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useEffect, type ReactNode } from "react";
import { NuqsAdapter } from "nuqs/adapters/react-router";
import {
  CircleDot,
  FolderGit2,
  MessageSquareText,
  Settings as SettingsIcon,
  ShieldCheck,
} from "lucide-react";
import { useAuthStore } from "@groot/shell/store/auth";
import { ProtectedRoute } from "@groot/shell/components/ProtectedRoute";
import { Layout } from "@groot/shell/components/Layout";
import {
  type NavDestination,
  type ShellConfig,
  ShellProvider,
} from "@groot/shell/lib/shell-config";
import { Settings } from "@groot/shell/pages/settings/Settings";
import { Login } from "@groot/shell/pages/auth/Login";
import { GrootUIProvider } from "@groot/ui/provider";
import { ProjectInbox } from "./pages/ProjectInbox";
import { Projects } from "./pages/Projects";

/**
 * Every page that has a place in the navigation, declared once: each entry
 * becomes a route and a sidebar (`primary`), account-menu and ⌘K entry.
 */
const PAGES: Array<NavDestination & { element: ReactNode }> = [
  { label: "Projects", icon: FolderGit2, to: "/projects", primary: true, element: <Projects /> },
  { label: "Settings", icon: SettingsIcon, to: "/settings", element: <Settings /> },
];

const SHELL_CONFIG: ShellConfig = {
  brand: { label: "FeedbackBee", icon: MessageSquareText, to: "/projects" },
  nav: PAGES,
  login: {
    tagline: "Feedback that lands in GitHub.",
    description:
      "A feedback widget for your site and Android app. Every report, with screenshots, replays and voice notes, becomes a GitHub issue.",
    features: [
      {
        icon: MessageSquareText,
        title: "One widget",
        desc: "A script tag on the web, an SDK on Android.",
      },
      {
        icon: CircleDot,
        title: "Issues, not inboxes",
        desc: "Reports are filed in the repo you choose.",
      },
      {
        icon: ShieldCheck,
        title: "Private by default",
        desc: "Reporter details never reach GitHub.",
      },
    ],
  },
};

function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <BrowserRouter>
      <NuqsAdapter>
        <GrootUIProvider>
          <ShellProvider config={SHELL_CONFIG}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/projects" replace />} />
                {PAGES.map((page) => (
                  <Route key={page.to} path={page.to} element={page.element} />
                ))}
                <Route path="projects/:slug" element={<ProjectInbox />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ShellProvider>
        </GrootUIProvider>
      </NuqsAdapter>
    </BrowserRouter>
  );
}

export default App;
