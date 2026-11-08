import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
// Inter loads from JS, not from the shell CSS: an @import there is inlined by
// Tailwind before Vite sees it, so the fonts' relative url()s were never
// emitted and production served index.html in their place.
import "@fontsource-variable/inter";
import "./styles.css";
import { initTheme, setDefaultTheme } from "@groot/shell/lib/theme";

// Light by default, like the website; the shell's theme switcher still offers dark.
setDefaultTheme("light");
initTheme();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
    // Mutations are not idempotent: a retried POST can create a duplicate.
    mutations: {
      retry: false,
    },
  },
});

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
