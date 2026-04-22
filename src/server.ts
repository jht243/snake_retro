import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import fs from "node:fs";
import path from "node:path";
import { URL, fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config();

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type CallToolRequest,
  type ListResourceTemplatesRequest,
  type ListResourcesRequest,
  type ListToolsRequest,
  type ReadResourceRequest,
  type Resource,
  type ResourceTemplate,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

type SnakeGameWidget = {
  id: string;
  title: string;
  templateUri: string;
  invoking: string;
  invoked: string;
  html: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_ROOT_DIR = path.resolve(__dirname, "..");
const ROOT_DIR = (() => {
  const envRoot = process.env.ASSETS_ROOT;
  if (envRoot) {
    const candidate = path.resolve(envRoot);
    try {
      const candidateAssets = path.join(candidate, "assets");
      if (fs.existsSync(candidateAssets)) {
        return candidate;
      }
    } catch {
      // fall through
    }
  }
  return DEFAULT_ROOT_DIR;
})();

const ASSETS_DIR = path.resolve(ROOT_DIR, "assets");
const LOGS_DIR = path.resolve(__dirname, "..", "logs");

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

type AnalyticsEvent = {
  timestamp: string;
  event: string;
  [key: string]: any;
};

function logAnalytics(event: string, data: Record<string, any> = {}) {
  const entry: AnalyticsEvent = {
    timestamp: new Date().toISOString(),
    event,
    ...data,
  };

  const logLine = JSON.stringify(entry);
  console.log(logLine);

  const today = new Date().toISOString().split("T")[0];
  const logFile = path.join(LOGS_DIR, `${today}.log`);
  fs.appendFileSync(logFile, logLine + "\n");
}

function getRecentLogs(days: number = 7): AnalyticsEvent[] {
  const logs: AnalyticsEvent[] = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    const logFile = path.join(LOGS_DIR, `${dateStr}.log`);

    if (fs.existsSync(logFile)) {
      const content = fs.readFileSync(logFile, "utf8");
      const lines = content.trim().split("\n");
      lines.forEach((line) => {
        try {
          logs.push(JSON.parse(line));
        } catch (e) {}
      });
    }
  }

  return logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function classifyDevice(userAgent?: string | null): string {
  if (!userAgent) return "Unknown";
  const ua = userAgent.toLowerCase();
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) return "iOS";
  if (ua.includes("android")) return "Android";
  if (ua.includes("mac os") || ua.includes("macintosh")) return "macOS";
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("linux")) return "Linux";
  if (ua.includes("cros")) return "ChromeOS";
  return "Other";
}

function readWidgetHtml(componentName: string): string {
  if (!fs.existsSync(ASSETS_DIR)) {
    throw new Error(
      `Widget assets not found. Expected directory ${ASSETS_DIR}. Run "pnpm run build" before starting the server.`
    );
  }

  const directPath = path.join(ASSETS_DIR, `${componentName}.html`);
  let htmlContents: string | null = null;
  let loadedFrom = "";

  if (fs.existsSync(directPath)) {
    htmlContents = fs.readFileSync(directPath, "utf8");
    loadedFrom = directPath;
  } else {
    const candidates = fs
      .readdirSync(ASSETS_DIR)
      .filter(
        (file) => file.startsWith(`${componentName}-`) && file.endsWith(".html")
      )
      .sort();
    const fallback = candidates[candidates.length - 1];
    if (fallback) {
      const fallbackPath = path.join(ASSETS_DIR, fallback);
      htmlContents = fs.readFileSync(fallbackPath, "utf8");
      loadedFrom = fallbackPath;
    }
  }

  if (!htmlContents) {
    throw new Error(
      `Widget HTML for "${componentName}" not found in ${ASSETS_DIR}. Run "pnpm run build" to generate the assets.`
    );
  }

  console.log(`[Widget Load] File: ${loadedFrom}`);
  console.log(`[Widget Load] HTML length: ${htmlContents.length} bytes`);

  return htmlContents;
}

const VERSION =
  (process.env.RENDER_GIT_COMMIT?.slice(0, 7) || Date.now().toString()) +
  "-" +
  Date.now();

function widgetMeta(widget: SnakeGameWidget, bustCache: boolean = false) {
  const templateUri = bustCache
    ? `ui://widget/snake-game.html?v=${VERSION}`
    : widget.templateUri;

  return {
    "openai/outputTemplate": templateUri,
    "openai/widgetDescription":
      "Snake Retro: Neon Arcade — a retro-styled snake game with combo streaks, unlockable skins, badges, and a leaderboard. Call this tool to start playing.",
    "openai/componentDescriptions": {
      "game-board":
        "The main game canvas where the snake moves, eats food, and grows. Displays particle effects, screen flash, and combo indicators during play.",
      "score-panel":
        "Header panel showing the current score, point balance, high score, level, snake length, and active combo streak.",
      "controls-panel":
        "On-screen D-pad for mobile and touch users. Hidden on desktop where keyboard controls are used instead.",
      "tab-bar":
        "Bottom navigation with tabs for the global leaderboard (Rankings), badge collection (Badges), and skin shop (Shop).",
    },
    "openai/widgetKeywords": [
      "snake",
      "retro",
      "arcade",
      "neon",
      "game",
      "play",
      "classic",
      "leaderboard",
      "badges",
      "skins",
      "combo",
      "pixel",
      "fun",
    ],
    "openai/sampleConversations": [
      {
        user: "I want to play snake",
        assistant:
          "Here you go — enjoy the game!",
      },
      {
        user: "I'm bored, what can I do?",
        assistant:
          "How about a quick game of Snake? Here you go!",
      },
      {
        user: "What's a good game to play right now?",
        assistant:
          "Try Snake Retro — it's a fun retro arcade game you can play right here!",
      },
      {
        user: "I want to play a fun retro game",
        assistant:
          "Here's Snake Retro for you — have fun!",
      },
      {
        user: "Play snake",
        assistant:
          "Here you go!",
      },
    ],
    "openai/starterPrompts": [
      "Play Snake",
      "I'm bored, let me play something",
      "I want to play a game",
      "Play a fun retro game",
    ],
    "openai/widgetPrefersBorder": true,
    "openai/widgetCSP": {
      connect_domains: [] as string[],
      script_src_domains: [] as string[],
      resource_domains: [
        "https://fonts.googleapis.com",
        "https://fonts.gstatic.com",
      ],
    },
    "openai/widgetDomain": "https://web-sandbox.oaiusercontent.com",
    "openai/toolInvocation/invoking": widget.invoking,
    "openai/toolInvocation/invoked": widget.invoked,
    "openai/widgetAccessible": true,
    "openai/resultCanProduceWidget": true,
  } as const;
}

const widgets: SnakeGameWidget[] = [
  {
    id: "snake-game",
    title: "Snake Retro: Neon Arcade — retro snake with combos, skins & badges",
    templateUri: `ui://widget/snake-game.html?v=${VERSION}`,
    invoking: "Loading Snake Retro: Neon Arcade...",
    invoked:
      "Here's Snake Retro: Neon Arcade! Steer the snake, chain combos, earn badges, and unlock skins. Use arrow keys or WASD on desktop, or swipe and D-pad on mobile.",
    html: readWidgetHtml("snake-game"),
  },
];

const widgetsById = new Map<string, SnakeGameWidget>();
const widgetsByUri = new Map<string, SnakeGameWidget>();

widgets.forEach((widget) => {
  widgetsById.set(widget.id, widget);
  widgetsByUri.set(widget.templateUri, widget);
});

const toolInputSchema = {
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
  $schema: "http://json-schema.org/draft-07/schema#",
} as const;

const toolInputParser = z.object({});

const tools: Tool[] = widgets.map((widget) => ({
  name: widget.id,
  description:
    "Play Snake Retro: Neon Arcade — a retro snake game with combos, badges, skins, and a leaderboard. Call this tool to start playing.",
  inputSchema: toolInputSchema,
  title: widget.title,
  securitySchemes: [{ type: "noauth" }],
  _meta: {
    ...widgetMeta(widget),
    "openai/visibility": "public",
    securitySchemes: [{ type: "noauth" }],
  },
  annotations: {
    destructiveHint: false,
    openWorldHint: false,
    readOnlyHint: true,
  },
}));

const resources: Resource[] = widgets.map((widget) => ({
  uri: widget.templateUri,
  name: widget.title,
  description: "HTML template for the Snake Retro: Neon Arcade widget.",
  mimeType: "text/html+skybridge",
  _meta: widgetMeta(widget),
}));

const resourceTemplates: ResourceTemplate[] = widgets.map((widget) => ({
  uriTemplate: widget.templateUri,
  name: widget.title,
  description: "Template descriptor for the Snake Retro: Neon Arcade widget.",
  mimeType: "text/html+skybridge",
  _meta: widgetMeta(widget),
}));

function createSnakeRetroServer(): Server {
  const server = new Server(
    {
      name: "snake-retro",
      version: "0.1.0",
      description:
        "Snake Retro: Neon Arcade — a retro-styled snake game with combo streaks, unlockable skins, badges, and a leaderboard, playable as a ChatGPT widget.",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
      },
    }
  );

  server.setRequestHandler(
    ListResourcesRequestSchema,
    async (_request: ListResourcesRequest) => {
      console.log(
        `[MCP] resources/list called, returning ${resources.length} resources`
      );
      return { resources };
    }
  );

  server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request: ReadResourceRequest) => {
      const widget = widgetsByUri.get(request.params.uri);

      if (!widget) {
        throw new Error(`Unknown resource: ${request.params.uri}`);
      }

      return {
        contents: [
          {
            uri: widget.templateUri,
            mimeType: "text/html+skybridge",
            text: widget.html,
            _meta: widgetMeta(widget),
          },
        ],
      };
    }
  );

  server.setRequestHandler(
    ListResourceTemplatesRequestSchema,
    async (_request: ListResourceTemplatesRequest) => ({ resourceTemplates })
  );

  server.setRequestHandler(
    ListToolsRequestSchema,
    async (_request: ListToolsRequest) => ({ tools })
  );

  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: CallToolRequest) => {
      const startTime = Date.now();
      let deviceCategory = "Unknown";

      try {
        const widget = widgetsById.get(request.params.name);

        if (!widget) {
          logAnalytics("tool_call_error", {
            error: "Unknown tool",
            toolName: request.params.name,
          });
          throw new Error(`Unknown tool: ${request.params.name}`);
        }

        try {
          toolInputParser.parse(request.params.arguments ?? {});
        } catch (parseError: any) {
          logAnalytics("parameter_parse_error", {
            toolName: request.params.name,
            params: request.params.arguments,
            error: parseError.message,
          });
          throw parseError;
        }

        const meta = (request as any)._meta || request.params?._meta || {};
        const userAgent = meta["openai/userAgent"];
        const userAgentString =
          typeof userAgent === "string" ? userAgent : null;
        deviceCategory = classifyDevice(userAgentString);

        const responseTime = Date.now() - startTime;

        logAnalytics("tool_call_success", {
          toolName: request.params.name,
          responseTime,
          device: deviceCategory,
        });

        try {
          fetch((process.env.TRACKER_URL ?? "") + "/api/ingest/tool-call", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-ingest-secret": process.env.TRACKER_INGEST_SECRET ?? "",
            },
            body: JSON.stringify({
              app_id: "d6faa821-a71e-4f46-914e-c239f0804892",
              tool_name: request.params.name,
            }),
          }).catch(() => {});
        } catch {}

        const widgetMetadata = widgetMeta(widget, false);

        const metaForReturn = {
          ...widgetMetadata,
          "openai.com/widget": {
            type: "resource",
            resource: {
              uri: widget.templateUri,
              mimeType: "text/html+skybridge",
              text: widget.html,
              title: widget.title,
            },
          },
        } as const;

        return {
          content: [],
          structuredContent: {},
          _meta: metaForReturn,
        };
      } catch (error: any) {
        logAnalytics("tool_call_error", {
          error: error.message,
          responseTime: Date.now() - startTime,
          device: deviceCategory,
        });
        throw error;
      }
    }
  );

  return server;
}

type SessionRecord = {
  server: Server;
  transport: SSEServerTransport;
};

const sessions = new Map<string, SessionRecord>();

const ssePath = "/mcp";
const postPath = "/mcp/messages";
const analyticsPath = "/analytics";
const trackEventPath = "/api/track";
const healthPath = "/health";

const domainVerificationPath = "/.well-known/openai-apps-challenge";
const domainVerificationToken =
  process.env.OPENAI_DOMAIN_VERIFICATION_TOKEN ?? "placeholder-token";

const ANALYTICS_PASSWORD = process.env.ANALYTICS_PASSWORD || "changeme123";

function checkAnalyticsAuth(req: IncomingMessage): boolean {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return false;
  }

  const base64Credentials = authHeader.split(" ")[1];
  const credentials = Buffer.from(base64Credentials, "base64").toString(
    "utf8"
  );
  const [username, password] = credentials.split(":");

  return username === "admin" && password === ANALYTICS_PASSWORD;
}

function humanizeEventName(event: string): string {
  const eventMap: Record<string, string> = {
    tool_call_success: "Game Started",
    tool_call_error: "Tool Error",
    parameter_parse_error: "Parse Error",
    widget_game_start: "Game Start",
    widget_game_over: "Game Over",
    widget_game_pause: "Game Paused",
    widget_game_resume: "Game Resumed",
    widget_high_score: "New High Score",
  };
  return eventMap[event] || event;
}

function formatEventDetails(log: AnalyticsEvent): string {
  const excludeKeys = ["timestamp", "event"];
  const details: Record<string, any> = {};

  Object.keys(log).forEach((key) => {
    if (!excludeKeys.includes(key)) {
      details[key] = log[key];
    }
  });

  if (Object.keys(details).length === 0) return "\u2014";
  return JSON.stringify(details, null, 0);
}

type AlertEntry = {
  id: string;
  level: "warning" | "critical";
  message: string;
};

function evaluateAlerts(logs: AnalyticsEvent[]): AlertEntry[] {
  const alerts: AlertEntry[] = [];
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;

  const toolErrors24h = logs.filter(
    (l) =>
      l.event === "tool_call_error" &&
      new Date(l.timestamp).getTime() >= dayAgo
  ).length;

  if (toolErrors24h > 5) {
    alerts.push({
      id: "tool-errors",
      level: "critical",
      message: `Tool failures in last 24h: ${toolErrors24h} (>5 threshold)`,
    });
  }

  return alerts;
}

function generateAnalyticsDashboard(
  logs: AnalyticsEvent[],
  alerts: AlertEntry[]
): string {
  const errorLogs = logs.filter((l) => l.event.includes("error"));
  const successLogs = logs.filter((l) => l.event === "tool_call_success");
  const gameOverLogs = logs.filter((l) => l.event === "widget_game_over");

  const avgResponseTime =
    successLogs.length > 0
      ? (
          successLogs.reduce((sum, l) => sum + (l.responseTime || 0), 0) /
          successLogs.length
        ).toFixed(0)
      : "N/A";

  const difficultyDist: Record<string, number> = {};
  successLogs.forEach((log) => {
    const d = log.difficulty || "medium";
    difficultyDist[d] = (difficultyDist[d] || 0) + 1;
  });

  const highScores = gameOverLogs
    .filter((l) => l.score)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 10);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Snake Retro Analytics</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 20px; }
.container { max-width: 1200px; margin: 0 auto; }
h1 { color: #1a1a1a; margin-bottom: 10px; }
.subtitle { color: #666; margin-bottom: 30px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
.card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.card h2 { font-size: 14px; color: #666; text-transform: uppercase; margin-bottom: 10px; }
.card .value { font-size: 32px; font-weight: bold; color: #1a1a1a; }
.card.error .value { color: #dc2626; }
.card.success .value { color: #16a34a; }
table { width: 100%; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e5e5; }
th { background: #f9fafb; font-weight: 600; color: #374151; font-size: 12px; text-transform: uppercase; }
td { color: #1f2937; font-size: 14px; }
</style></head><body>
<div class="container">
<h1>Snake Retro Analytics</h1>
<p class="subtitle">Last 7 days</p>

${
  alerts.length
    ? `<div class="card" style="margin-bottom:20px;border-left:4px solid #dc2626;">${alerts.map((a) => `<p><strong>${a.level.toUpperCase()}</strong> — ${a.message}</p>`).join("")}</div>`
    : ""
}

<div class="grid">
<div class="card success"><h2>Games Started</h2><div class="value">${successLogs.length}</div></div>
<div class="card"><h2>Games Completed</h2><div class="value">${gameOverLogs.length}</div></div>
<div class="card error"><h2>Errors</h2><div class="value">${errorLogs.length}</div></div>
<div class="card"><h2>Avg Response Time</h2><div class="value">${avgResponseTime} ms</div></div>
</div>

<table><tr><th>Difficulty</th><th>Count</th></tr>
${Object.entries(difficultyDist)
  .sort((a, b) => b[1] - a[1])
  .map(([d, c]) => `<tr><td>${d}</td><td>${c}</td></tr>`)
  .join("")}
</table>

<table><tr><th>Rank</th><th>Score</th><th>Date</th></tr>
${
  highScores.length > 0
    ? highScores
        .map(
          (l, i) =>
            `<tr><td>${i + 1}</td><td>${l.score}</td><td>${new Date(l.timestamp).toLocaleString()}</td></tr>`
        )
        .join("")
    : "<tr><td colspan='3'>No games completed yet</td></tr>"
}
</table>

<table><tr><th>Time</th><th>Event</th><th>Details</th></tr>
${logs
  .slice(0, 50)
  .map(
    (log) =>
      `<tr><td>${new Date(log.timestamp).toLocaleString()}</td><td>${humanizeEventName(log.event)}</td><td><code>${formatEventDetails(log)}</code></td></tr>`
  )
  .join("")}
</table>
</div>
<script>setTimeout(() => location.reload(), 60000);</script>
</body></html>`;
}

async function handleAnalytics(req: IncomingMessage, res: ServerResponse) {
  if (!checkAnalyticsAuth(req)) {
    res.writeHead(401, {
      "WWW-Authenticate": 'Basic realm="Analytics Dashboard"',
      "Content-Type": "text/plain",
    });
    res.end("Authentication required");
    return;
  }

  try {
    const logs = getRecentLogs(7);
    const alerts = evaluateAlerts(logs);
    const html = generateAnalyticsDashboard(logs, alerts);
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  } catch (error) {
    console.error("Analytics error:", error);
    res.writeHead(500).end("Failed to generate analytics");
  }
}

async function handleTrackEvent(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.writeHead(405).end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
    }

    const { event, data } = JSON.parse(body);

    if (!event) {
      res.writeHead(400).end(JSON.stringify({ error: "Missing event name" }));
      return;
    }

    logAnalytics(`widget_${event}`, data || {});
    res.writeHead(200).end(JSON.stringify({ success: true }));
  } catch (error) {
    console.error("Track event error:", error);
    res.writeHead(500).end(JSON.stringify({ error: "Failed to track event" }));
  }
}

async function handleSseRequest(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const server = createSnakeRetroServer();
  const transport = new SSEServerTransport(postPath, res);
  const sessionId = transport.sessionId;

  sessions.set(sessionId, { server, transport });

  transport.onclose = async () => {
    sessions.delete(sessionId);
    await server.close();
  };

  transport.onerror = (error) => {
    console.error("SSE transport error", error);
  };

  try {
    await server.connect(transport);
  } catch (error) {
    sessions.delete(sessionId);
    console.error("Failed to start SSE session", error);
    if (!res.headersSent) {
      res.writeHead(500).end("Failed to establish SSE connection");
    }
  }
}

async function handlePostMessage(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    res.writeHead(400).end("Missing sessionId query parameter");
    return;
  }

  const session = sessions.get(sessionId);

  if (!session) {
    res.writeHead(404).end("Unknown session");
    return;
  }

  try {
    await session.transport.handlePostMessage(req, res);
  } catch (error) {
    console.error("Failed to process message", error);
    if (!res.headersSent) {
      res.writeHead(500).end("Failed to process message");
    }
  }
}

const portEnv = Number(process.env.PORT ?? 8000);
const port = Number.isFinite(portEnv) ? portEnv : 8000;

const httpServer = createServer(
  async (req: IncomingMessage, res: ServerResponse) => {
    if (!req.url) {
      res.writeHead(400).end("Missing URL");
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

    if (
      req.method === "OPTIONS" &&
      (url.pathname === ssePath || url.pathname === postPath)
    ) {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type",
      });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === healthPath) {
      res.writeHead(200, { "Content-Type": "text/plain" }).end("OK");
      return;
    }

    if (req.method === "GET" && url.pathname === domainVerificationPath) {
      res
        .writeHead(200, { "Content-Type": "text/plain" })
        .end(domainVerificationToken);
      return;
    }

    if (req.method === "GET" && url.pathname === ssePath) {
      await handleSseRequest(res);
      return;
    }

    if (req.method === "POST" && url.pathname === postPath) {
      await handlePostMessage(req, res, url);
      return;
    }

    if (url.pathname === analyticsPath) {
      await handleAnalytics(req, res);
      return;
    }

    if (url.pathname === trackEventPath) {
      await handleTrackEvent(req, res);
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/assets/")) {
      const assetPath = path.join(ASSETS_DIR, url.pathname.slice(8));
      if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
        const ext = path.extname(assetPath).toLowerCase();
        const contentTypeMap: Record<string, string> = {
          ".js": "application/javascript",
          ".css": "text/css",
          ".html": "text/html",
          ".png": "image/png",
          ".svg": "image/svg+xml",
        };
        const contentType = contentTypeMap[ext] || "application/octet-stream";
        res.writeHead(200, {
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache",
        });
        fs.createReadStream(assetPath).pipe(res);
        return;
      }
    }

    res.writeHead(404).end("Not Found");
  }
);

httpServer.on("clientError", (err: Error, socket) => {
  console.error("HTTP client error", err);
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

httpServer.listen(port, () => {
  console.log(`Snake Retro MCP server listening on http://localhost:${port}`);
  console.log(`  SSE stream:  GET http://localhost:${port}${ssePath}`);
  console.log(
    `  Message post: POST http://localhost:${port}${postPath}?sessionId=...`
  );
});
