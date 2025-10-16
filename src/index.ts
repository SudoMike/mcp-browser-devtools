#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

import { loadConfig, type LoadedConfig } from "./config.js";
import { sessionManager } from "./session/manager.js";
import { isDevToolsError } from "./errors.js";
import type {
  NavigateParams,
  GetElementParams,
  GetCssProvenanceParams,
  PageInteractParams,
  GetPageContentParams,
  ScreenshotParams,
} from "./types.js";

import { sessionStart } from "./tools/session-start.js";
import { sessionStop } from "./tools/session-stop.js";
import { navigate } from "./tools/navigate.js";
import { getElement } from "./tools/get-element.js";
import { getCssProvenance } from "./tools/get-css-provenance.js";
import { pageInteract } from "./tools/page-interact.js";
import { getPageContent } from "./tools/get-page-content.js";
import { screenshot } from "./tools/screenshot.js";

// Parse CLI args
const args = process.argv.slice(2);
const configPathIndex = args.indexOf("--config");

if (configPathIndex === -1 || !args[configPathIndex + 1]) {
  console.error("Usage: mcp-browser-devtools --config <path-to-config.json>");
  process.exit(1);
}

const configPath = args[configPathIndex + 1];

// Load config
let loadedConfig: LoadedConfig;
try {
  loadedConfig = await loadConfig({ configPath });
} catch (err) {
  console.error(`Failed to load config: ${err}`);
  process.exit(1);
}

// Create MCP server
const server = new Server(
  {
    name: "mcp-browser-devtools",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Build dynamic description for session.start tool including available scenarios
let sessionStartDescription =
  "Start a new Playwright browser session. " +
  "You must specify a scenario from your config file to run hooks (e.g., logged-in vs guest mode). " +
  "Only one session can be active at a time. " +
  "Set interactive=true to launch a visible browser window that the user can manually interact with " +
  "before/during automated operations (useful for manual login, debugging, or complex workflows).";

if (loadedConfig.hooks?.scenarios) {
  const scenarioCount = Object.keys(loadedConfig.hooks.scenarios).length;
  if (scenarioCount > 0) {
    sessionStartDescription += "\n\nAvailable scenarios:";
    for (const [name, config] of Object.entries(loadedConfig.hooks.scenarios)) {
      sessionStartDescription += `\n- ${name}`;
      if (config.description) {
        sessionStartDescription += `: ${config.description}`;
      } else {
        sessionStartDescription += ` (uses hook: ${config.use})`;
      }
    }
  }
}

// Define tools
const tools: Tool[] = [
  {
    name: "devtools.session.start",
    description: sessionStartDescription,
    inputSchema: {
      type: "object",
      properties: {
        scenario: {
          type: "string",
          description:
            "Required scenario name to run specific hooks " +
            "(must be defined in config)",
        },
        interactive: {
          type: "boolean",
          description:
            "Launch browser in headed mode (visible window) for manual user interaction. " +
            "After starting, user can manually navigate, login, or perform any actions " +
            "before using other MCP tools on the current browser state. (default: false)",
        },
      },
    },
  },
  {
    name: "devtools.session.stop",
    description: "Stop the current browser session and clean up all resources.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "devtools.session.navigate",
    description:
      "Navigate the browser to a URL. " +
      "The URL can be absolute or relative to baseURL.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL to navigate to (absolute or relative to baseURL)",
        },
        wait: {
          type: "string",
          enum: ["load", "domcontentloaded", "networkidle"],
          description: "Wait strategy (default: networkidle)",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "devtools.getElement",
    description:
      "Get detailed information about elements matching a selector or ID. " +
      "Returns box model, computed styles, attributes, and role. " +
      "Returns first match by default; use maxResults for multiple matches.",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "object",
          properties: {
            kind: {
              type: "string",
              enum: ["id", "selector"],
              description: "Type of selector",
            },
            value: {
              type: "string",
              description: "ID value or CSS selector",
            },
          },
          required: ["kind", "value"],
        },
        include: {
          type: "object",
          properties: {
            boxModel: {
              type: "boolean",
              description:
                "Include box model (dimensions, padding, border, margin)",
            },
            attributes: {
              type: "boolean",
              description: "Include element attributes (id, class, etc.)",
            },
            role: {
              type: "boolean",
              description: "Include ARIA role (explicit or inferred)",
            },
            computed: {
              type: "array",
              items: {
                type: "string",
              },
              description:
                "Array of CSS property names to include. " +
                'Use "ALL_DEFAULTS" to include default high-value properties ' +
                "(display, position, width, height, margin-*, padding-*, " +
                "border-*-width, font-*, color, background-color, etc.). " +
                'Example: ["ALL_DEFAULTS", "border-left-color", "font-style"]',
            },
          },
          description:
            "What information to include " +
            "(all fields default to false/empty if not specified)",
        },
        maxResults: {
          type: "number",
          description:
            "Maximum number of matching elements to return " +
            "(default: 10, max: 50)",
        },
      },
      required: ["target"],
    },
  },
  {
    name: "devtools.getCssProvenance",
    description:
      "Get the source of a CSS property value, " +
      "including which rule/file/line set it. " +
      "IMPORTANT: You MUST use longhand CSS properties " +
      '(e.g., "border-top-width", not "border"). ' +
      "Returns computed value and winning declaration with source location.",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "object",
          properties: {
            kind: {
              type: "string",
              enum: ["id", "selector"],
              description: "Type of selector",
            },
            value: {
              type: "string",
              description: "ID value or CSS selector",
            },
          },
          required: ["kind", "value"],
        },
        property: {
          type: "string",
          description:
            "CSS property name " +
            '(MUST be longhand, e.g., "border-top-width" not "border")',
        },
        includeContributors: {
          type: "boolean",
          description:
            "Include non-winning declarations in cascade (default: false)",
        },
        maxResults: {
          type: "number",
          description:
            "Maximum number of matching elements to analyze " +
            "(default: 10, max: 50)",
        },
      },
      required: ["target", "property"],
    },
  },
  {
    name: "devtools.page.interact",
    description:
      "Execute a sequence of page interactions (click, fill, type, wait, etc.). " +
      "Actions are executed sequentially. " +
      "Returns success or the index of the failed action with error details.",
    inputSchema: {
      type: "object",
      properties: {
        actions: {
          type: "array",
          description: "Array of actions to execute sequentially",
          items: {
            oneOf: [
              {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["click"] },
                  selector: { type: "string" },
                  options: {
                    type: "object",
                    properties: {
                      button: {
                        type: "string",
                        enum: ["left", "right", "middle"],
                      },
                      clickCount: { type: "number" },
                      delay: { type: "number" },
                    },
                  },
                },
                required: ["type", "selector"],
              },
              {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["fill"] },
                  selector: { type: "string" },
                  value: { type: "string" },
                },
                required: ["type", "selector", "value"],
              },
              {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["type"] },
                  selector: { type: "string" },
                  text: { type: "string" },
                  options: {
                    type: "object",
                    properties: {
                      delay: { type: "number" },
                    },
                  },
                },
                required: ["type", "selector", "text"],
              },
              {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["press"] },
                  selector: { type: "string" },
                  key: { type: "string" },
                  options: {
                    type: "object",
                    properties: {
                      delay: { type: "number" },
                    },
                  },
                },
                required: ["type", "selector", "key"],
              },
              {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["select"] },
                  selector: { type: "string" },
                  values: {
                    oneOf: [
                      { type: "string" },
                      { type: "array", items: { type: "string" } },
                    ],
                  },
                },
                required: ["type", "selector", "values"],
              },
              {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["wait"] },
                  delay: { type: "number" },
                },
                required: ["type", "delay"],
              },
              {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["waitForSelector"] },
                  selector: { type: "string" },
                  options: {
                    type: "object",
                    properties: {
                      state: {
                        type: "string",
                        enum: ["attached", "detached", "visible", "hidden"],
                      },
                      timeout: { type: "number" },
                    },
                  },
                },
                required: ["type", "selector"],
              },
              {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["waitForNavigation"] },
                  options: {
                    type: "object",
                    properties: {
                      waitUntil: {
                        type: "string",
                        enum: ["load", "domcontentloaded", "networkidle"],
                      },
                      timeout: { type: "number" },
                    },
                  },
                },
                required: ["type"],
              },
            ],
          },
        },
      },
      required: ["actions"],
    },
  },
  {
    name: "devtools.session.getPageContent",
    description:
      "Get the raw HTML content from the current page. " +
      "Optionally specify a starting character position and length to retrieve a slice of the HTML. " +
      "Always returns the full length of the HTML for context.",
    inputSchema: {
      type: "object",
      properties: {
        start: {
          type: "number",
          description: "Starting character position (default: 0)",
        },
        length: {
          type: "number",
          description:
            "Number of characters to return. Use -1 for remainder of HTML after start (default: -1)",
        },
      },
    },
  },
  {
    name: "devtools.page.screenshot",
    description:
      "Take a screenshot of the current page and save it to a temporary file. " +
      "Returns the absolute path to the screenshot file. " +
      "By default, captures only the visible viewport as PNG.",
    inputSchema: {
      type: "object",
      properties: {
        fullPage: {
          type: "boolean",
          description:
            "Capture the full scrollable page instead of just the viewport (default: false)",
        },
        type: {
          type: "string",
          enum: ["png", "jpeg"],
          description: "Image format (default: png)",
        },
        quality: {
          type: "number",
          description:
            "JPEG quality from 0-100 (only applies to jpeg type, default: 80)",
        },
      },
    },
  },
];

// Handle list tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    switch (name) {
      case "devtools.session.start": {
        const result = await sessionStart(
          args as Record<string, unknown>,
          loadedConfig,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "devtools.session.stop": {
        const result = await sessionStop();
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "devtools.session.navigate": {
        const result = await navigate(args as unknown as NavigateParams);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "devtools.getElement": {
        const result = await getElement(args as unknown as GetElementParams);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "devtools.getCssProvenance": {
        const result = await getCssProvenance(
          args as unknown as GetCssProvenanceParams,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "devtools.page.interact": {
        const result = await pageInteract(
          args as unknown as PageInteractParams,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "devtools.session.getPageContent": {
        const result = await getPageContent(
          args as unknown as GetPageContentParams,
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "devtools.page.screenshot": {
        const result = await screenshot(args as unknown as ScreenshotParams);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    if (isDevToolsError(err)) {
      return {
        content: [{ type: "text", text: JSON.stringify(err, null, 2) }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: {
                code: "UNEXPECTED_ERROR",
                message: String(err),
              },
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }
});

// Handle shutdown
async function shutdown() {
  await sessionManager.stop();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);

console.error("MCP DevTools server running");
