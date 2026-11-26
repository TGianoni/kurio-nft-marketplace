import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

async function startApp() {
  const enableMocks = import.meta.env.VITE_ENABLE_MOCKS !== "false";

  if (enableMocks) {
    const { worker } = await import("./mocks/browser");
    await worker.start({
      onUnhandledRequest(request, print) {
        const url = new URL(request.url);
        if (url.pathname.startsWith("/api/")) {
          print.warning();
        }
      },
    });
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void startApp();
