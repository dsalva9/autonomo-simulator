import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./services/pwa/registerServiceWorker.ts";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Missing #root container element in index.html.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

void registerServiceWorker();
