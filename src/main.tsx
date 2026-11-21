import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/inter";
import "@fontsource-variable/orbitron";
import "@fontsource-variable/jetbrains-mono";
import "./index.css";
import App from "./App";
import { applySettings, loadSettings } from "./lib/themes";

// Aplicar el tema guardado antes del primer pintado (sin parpadeo).
applySettings(loadSettings());

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
