import React from "react";
import { createRoot } from "react-dom/client";
import SnakeGame from "./component";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: any }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Widget Error Boundary caught error:", error, errorInfo);
    try {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "crash",
          data: {
            error: error?.message || "Unknown error",
            stack: error?.stack,
            componentStack: errorInfo?.componentStack,
          },
        }),
      }).catch(() => {});
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, textAlign: "center", color: "#f87171" }}>
          <p style={{ fontSize: 18, fontWeight: 600 }}>Something went wrong.</p>
          <p style={{ marginTop: 8, color: "#94a3b8" }}>
            Please try refreshing the page.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

interface OpenAIGlobals {
  toolOutput?: any;
  structuredContent?: any;
  toolInput?: any;
  result?: { structuredContent?: any };
}

const getHydrationData = (): any => {
  if (typeof window === "undefined") return {};

  const oa = (window as any).openai as OpenAIGlobals;
  if (!oa) return {};

  const candidates = [
    oa.toolOutput,
    oa.structuredContent,
    oa.result?.structuredContent,
    oa.toolInput,
  ];

  for (const candidate of candidates) {
    if (
      candidate &&
      typeof candidate === "object" &&
      Object.keys(candidate).length > 0
    ) {
      return candidate;
    }
  }

  return {};
};

const container = document.getElementById("snake-game-root");

if (!container) {
  throw new Error("snake-game-root element not found");
}

const root = createRoot(container);

const renderApp = (data: any) => {
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <SnakeGame initialData={data} />
      </ErrorBoundary>
    </React.StrictMode>
  );
};

const initialData = getHydrationData();
renderApp(initialData);

window.addEventListener("openai:set_globals", (ev: any) => {
  const globals = ev?.detail?.globals;
  if (globals) {
    const candidates = [
      globals.toolOutput,
      globals.structuredContent,
      globals.result?.structuredContent,
      globals.toolInput,
    ];

    for (const candidate of candidates) {
      if (
        candidate &&
        typeof candidate === "object" &&
        Object.keys(candidate).length > 0
      ) {
        renderApp(candidate);
        return;
      }
    }
  }
});
