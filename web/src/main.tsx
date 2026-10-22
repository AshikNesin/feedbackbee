import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Login } from "./login.tsx";
import { Dashboard } from "./dashboard.tsx";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);
const page = location.pathname === "/login" ? <Login /> : <Dashboard />;
root.render(<StrictMode>{page}</StrictMode>);
