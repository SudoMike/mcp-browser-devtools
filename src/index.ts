#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { loadConfig, type LoadedConfig } from './config.js';
import { sessionManager } from './session/manager.js';
import { isDevToolsError } from './errors.js';

import { sessionStart } from './tools/session-start.js';
import { sessionStop } from './tools/session-stop.js';
import { navigate } from './tools/navigate.js';
import { getElement } from './tools/get-element.js';
import { getCssProvenance } from './tools/get-css-provenance.js';

// Parse CLI args
const args = process.argv.slice(2);
const configPathIndex = args.indexOf('--config');

if (configPathIndex === -1 || !args[configPathIndex + 1]) {
  console.error('Usage: mcp-devtools --config <path-to-config.json>');
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
    name: 'mcp-devtools',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools
const tools: Tool[] = [
  {
    name: 'devtools.session.start',
    description: 'Start a new Playwright browser session. Optionally specify a scenario to run hooks (e.g., logged-in vs guest mode). Only one session can be active at a time.',
    inputSchema: {
      type: 'object',
      properties: {
        scenario: {
          type: 'string',
          description: 'Optional scenario name to run specific hooks (must be defined in config)',
        },
      },
    },
  },
  {
    name: 'devtools.session.stop',
    description: 'Stop the current browser session and clean up all resources.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'devtools.session.navigate',
    description: 'Navigate the browser to a URL. The URL can be absolute or relative to baseURL.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to navigate to (absolute or relative to baseURL)',
        },
        wait: {
          type: 'string',
          enum: ['load', 'domcontentloaded', 'networkidle'],
          description: 'Wait strategy (default: networkidle)',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'devtools.getElement',
    description: 'Get detailed information about elements matching a selector or ID. Returns box model, computed styles, attributes, and role. Returns first match by default; use maxResults for multiple matches.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'object',
          properties: {
            kind: {
              type: 'string',
              enum: ['id', 'selector'],
              description: 'Type of selector',
            },
            value: {
              type: 'string',
              description: 'ID value or CSS selector',
            },
          },
          required: ['kind', 'value'],
        },
        include: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['boxModel', 'computed', 'attributes', 'role'],
          },
          description: 'What information to include (default: all)',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of matching elements to return (default: 10, max: 50)',
        },
      },
      required: ['target'],
    },
  },
  {
    name: 'devtools.getCssProvenance',
    description: 'Get the source of a CSS property value, including which rule/file/line set it. IMPORTANT: You MUST use longhand CSS properties (e.g., "border-top-width", not "border"). Returns computed value and winning declaration with source location.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'object',
          properties: {
            kind: {
              type: 'string',
              enum: ['id', 'selector'],
              description: 'Type of selector',
            },
            value: {
              type: 'string',
              description: 'ID value or CSS selector',
            },
          },
          required: ['kind', 'value'],
        },
        property: {
          type: 'string',
          description: 'CSS property name (MUST be longhand, e.g., "border-top-width" not "border")',
        },
        includeContributors: {
          type: 'boolean',
          description: 'Include non-winning declarations in cascade (default: false)',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of matching elements to analyze (default: 10, max: 50)',
        },
      },
      required: ['target', 'property'],
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
      case 'devtools.session.start': {
        const result = await sessionStart(args as any, loadedConfig);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'devtools.session.stop': {
        const result = await sessionStop();
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'devtools.session.navigate': {
        const result = await navigate(args as any);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'devtools.getElement': {
        const result = await getElement(args as any);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'devtools.getCssProvenance': {
        const result = await getCssProvenance(args as any);
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err) {
    if (isDevToolsError(err)) {
      return {
        content: [{ type: 'text', text: JSON.stringify(err, null, 2) }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: {
                code: 'UNEXPECTED_ERROR',
                message: String(err),
              },
            },
            null,
            2
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

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);

console.error('MCP DevTools server running');
