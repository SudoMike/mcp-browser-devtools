# MCP DevTools

An MCP (Model Context Protocol) server that provides DevTools-style browser inspection capabilities via Playwright. Gives LLM coding agents live, runtime visibility into web applications for debugging and development with real context: DOM elements, computed CSS with rule provenance, box models, attributes, roles, and more.

## Features

- **Session-based browser control**: Single Playwright instance per server process for speed and determinism
- **Project-agnostic**: Configure via hooks module - no hard-coded app knowledge
- **CSS provenance**: Trace computed styles to their source (file, line, selector, !important)
- **Element inspection**: Get box model, attributes, computed styles, and ARIA roles
- **Scenario-based hooks**: Support different startup modes (guest, logged-in, etc.)
- **Security**: Origin allowlists, idle timeouts, no exposed debugging ports

## Installation

```bash
npm install mcp-devtools
```

**Note**: This package has a peer dependency on `playwright`. Make sure Playwright is installed in your project:

```bash
npm install playwright
```

## Quick Start

1. **Create a configuration file** (`mcp-devtools.config.json`):

```json
{
  "playwright": {
    "baseURL": "http://localhost:3000",
    "headless": true
  },
  "hooks": {
    "modulePath": "./devtools-hooks.js",
    "scenarios": {
      "default": { "use": "startDefault" },
      "loggedIn": { "use": "startLoggedIn" }
    }
  },
  "policy": {
    "idleMs": 300000,
    "allowedOrigins": ["http://localhost:3000"]
  }
}
```

2. **Create a hooks module** (`devtools-hooks.js`):

```javascript
export async function startDefault({ page, baseURL }) {
  // Optional: start your app server, seed database, etc.
  // Navigate to homepage
  await page.goto(baseURL);

  return {
    stop: async () => {
      // Cleanup: stop servers, etc.
    }
  };
}

export async function startLoggedIn({ page, baseURL }) {
  // Start app server, seed test database with user, etc.
  // Then perform login to get browser into logged-in state
  await page.goto(baseURL + '/login');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');

  return {
    stop: async () => {
      // Cleanup: stop servers, clean database, etc.
    }
  };
}
```

3. **Run the MCP server**:

```bash
npx mcp-devtools --config mcp-devtools.config.json
```

## MCP Tools

### `devtools.session.start`

Start a new Playwright browser session.

**Parameters:**
- `scenario` (optional): Scenario name to run specific hooks

**Example:**
```json
{
  "scenario": "loggedIn"
}
```

### `devtools.session.stop`

Stop the current browser session and clean up all resources.

### `devtools.session.navigate`

Navigate the browser to a URL.

**Parameters:**
- `url` (required): Absolute or relative URL
- `wait` (optional): Wait strategy - `"load"`, `"domcontentloaded"`, or `"networkidle"` (default)

**Example:**
```json
{
  "url": "/dashboard",
  "wait": "networkidle"
}
```

### `devtools.session.getPageContent`

Get the raw HTML content from the current page.

**Parameters:**
- `start` (optional): Starting character position (default: 0)
- `length` (optional): Number of characters to return. Use -1 for remainder of HTML after start (default: -1)

**Example:**
```json
{
  "start": 0,
  "length": 1000
}
```

**Response:**
```json
{
  "html": "<!DOCTYPE html><html>...",
  "fullLength": 15432
}
```

### `devtools.page.interact`

Execute a sequence of page interactions (click, fill, type, wait, etc.).

**Parameters:**
- `actions` (required): Array of action objects to execute sequentially

**Supported Actions:**
- `click`: Click an element
- `fill`: Fill a form field
- `type`: Type text with delays between keystrokes
- `press`: Press a key
- `select`: Select option(s) from dropdown
- `wait`: Wait for a delay
- `waitForSelector`: Wait for element to appear/disappear
- `waitForNavigation`: Wait for navigation to complete

**Example:**
```json
{
  "actions": [
    {
      "type": "fill",
      "selector": "input[name='search']",
      "value": "playwright"
    },
    {
      "type": "click",
      "selector": "button[type='submit']"
    },
    {
      "type": "waitForSelector",
      "selector": ".search-results",
      "options": { "state": "visible" }
    }
  ]
}
```

**Response:**
- Success: `{"ok": true}`
- Failure: `{"ok": false, "failedAtIndex": 1, "error": "...", "action": {...}}`

### `devtools.getElement`

Get detailed information about elements matching a selector or ID.

**Parameters:**
- `target` (required):
  - `kind`: `"id"` or `"selector"`
  - `value`: ID value or CSS selector
- `include` (optional): Array of `["boxModel", "computed", "attributes", "role"]`
- `maxResults` (optional): Max elements to return (default: 10, max: 50)

**Example:**
```json
{
  "target": { "kind": "selector", "value": ".primary-button" },
  "include": ["boxModel", "computed", "attributes"],
  "maxResults": 5
}
```

**Response:**
```json
{
  "matchCount": 3,
  "results": [
    {
      "exists": true,
      "nodeName": "BUTTON",
      "attributes": { "class": "primary-button", "type": "submit" },
      "role": "button",
      "boxModel": {
        "x": 100, "y": 200, "width": 120, "height": 40,
        "content": { "x": 100, "y": 200, "width": 120, "height": 40 },
        "padding": { "x": 90, "y": 190, "width": 140, "height": 60 },
        "border": { "x": 89, "y": 189, "width": 142, "height": 62 },
        "margin": { "x": 89, "y": 189, "width": 142, "height": 62 }
      },
      "computed": {
        "display": "inline-block",
        "background-color": "rgb(0, 123, 255)",
        "padding-top": "10px",
        "border-top-width": "1px"
      }
    }
  ]
}
```

### `devtools.getCssProvenance`

Get the source of a CSS property value, including which rule/file/line set it.

**⚠️ IMPORTANT**: You **MUST** use longhand CSS properties (e.g., `"border-top-width"`, not `"border"`).

**Parameters:**
- `target` (required): Same as `getElement`
- `property` (required): CSS property name (longhand only)
- `includeContributors` (optional): Include non-winning declarations (default: false)
- `maxResults` (optional): Max elements to analyze (default: 10, max: 50)

**Example:**
```json
{
  "target": { "kind": "id", "value": "header" },
  "property": "border-top-width",
  "includeContributors": true
}
```

**Response:**
```json
{
  "matchCount": 1,
  "results": [
    {
      "property": "border-top-width",
      "computedValue": "2px",
      "winner": {
        "source": "stylesheet",
        "selector": ".header",
        "stylesheetUrl": "http://localhost:3000/styles/main.css",
        "line": 42,
        "column": 2,
        "important": false,
        "snippet": "border-top-width: 2px;",
        "value": "2px"
      },
      "contributors": [
        {
          "source": "stylesheet",
          "selector": "*",
          "stylesheetUrl": "http://localhost:3000/styles/reset.css",
          "line": 5,
          "column": 2,
          "value": "0"
        }
      ]
    }
  ]
}
```

## Configuration Reference

### `playwright`

- `baseURL` (optional): Base URL for relative navigations
- `headless` (optional, default: `true`): Run browser in headless mode
- `storageStatePath` (optional): Path to Playwright storage state file (for pre-authenticated sessions)
- `traceOutputPath` (optional): Path to save Playwright trace file (e.g., `"./trace.zip"`). When set, automatically records all browser interactions, DOM snapshots, network requests, console logs, and screenshots. View traces with: `npx playwright show-trace <trace-file.zip>`

### `hooks`

- `modulePath` (required): Path to hooks module (relative to config file)
- `envPath` (optional): Path to .env file (relative to config file)
- `scenarios` (optional): Named scenarios mapping to hook functions

### `policy`

- `singleInstance` (optional, default: `true`): Enforce single session
- `idleMs` (optional, default: `300000`): Idle timeout in milliseconds
- `allowedOrigins` (optional): Array of allowed origins for navigation

### `timeouts`

- `navigationMs` (optional, default: `15000`): Navigation timeout
- `queryMs` (optional, default: `8000`): Query timeout

## Error Codes

All errors follow this format:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

Error codes:
- `ALREADY_STARTED`: Session already active
- `SESSION_START_IN_PROGRESS`: Start already in progress
- `NO_ACTIVE_SESSION`: No session active
- `PLAYWRIGHT_LAUNCH_FAILED`: Failed to launch browser
- `HOOKS_START_FAILED`: Hook execution failed
- `HOOKS_STOP_FAILED`: Hook cleanup failed
- `NAVIGATION_TIMEOUT`: Navigation timed out
- `NAVIGATION_BLOCKED_BY_POLICY`: Origin not allowed
- `ELEMENT_NOT_FOUND`: No matching elements
- `CSS_DOMAIN_UNAVAILABLE`: CDP CSS domain unavailable
- `QUERY_TIMEOUT`: Query timed out
- `UNEXPECTED_ERROR`: Unexpected error

## Examples

See the [examples/](./examples/) directory for complete working examples.

## Hooks Module API

Hooks are optional JavaScript/TypeScript functions that customize behavior for different scenarios.

### Hook Context

All hooks receive a context object with the Playwright page and configuration:

```typescript
{
  page: Page;       // Playwright page instance
  baseURL?: string; // Configured base URL
}
```

### Hook Result

Hooks should return (or return a Promise of):

```typescript
{
  stop?: () => void | Promise<void>; // Optional cleanup function
}
```

### Hook Execution

1. When a scenario is specified in `session.start`, the corresponding hook function is called **once**
2. The hook receives a fully initialized Playwright page
3. The hook should:
   - Set up project-specific infrastructure (start servers, seed databases, etc.)
   - Navigate and interact with the page to reach the desired initial state
   - Return a cleanup function if needed
4. The `stop()` function (if returned) is called when the session stops

### Typical Hook Patterns

**Guest/Public Scenario:**
```javascript
export async function startGuest({ page, baseURL }) {
  await page.goto(baseURL);
  return {};
}
```

**Authenticated Scenario:**
```javascript
export async function startLoggedIn({ page, baseURL }) {
  // Reuse your e2e test setup code
  await seedTestDatabase({ email: 'test@example.com' });
  await page.goto(baseURL + '/login');
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');

  return {
    stop: async () => {
      await cleanupTestDatabase();
    }
  };
}
```

**Admin Scenario:**
```javascript
export async function startAdmin({ page, baseURL }) {
  await seedAdminUser();
  await loginAsAdmin(page, baseURL);
  return { stop: cleanupAdmin };
}
```

## Limitations (v1)

- **Top document only**: No shadow DOM or iframe traversal
- **Chromium only**: CDP CSS domain is Chromium-specific
- **No pseudo-elements**: `::before`/`::after` not supported yet
- **Longhand properties only**: Shorthands like `border` must be expanded

## Roadmap

- **v1.1**: Full Styles cascade, pseudo-elements, basic iframe/shadow DOM
- **v2**: Screenshot attachments, richer accessibility queries, optional Puppeteer adapter

## License

ISC

## Contributing

Issues and PRs welcome at [github.com/yourorg/mcp-devtools](https://github.com/yourorg/mcp-devtools)
