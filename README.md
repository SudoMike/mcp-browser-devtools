# MCP DevTools

An MCP (Model Context Protocol) server that provides DevTools-style browser inspection capabilities via Playwright. Gives LLM coding agents live, runtime visibility into web applications for debugging and development with real context: DOM elements, computed CSS with rule provenance, box models, attributes, roles, and more.

## Features

- **Session-based browser control**: Single Playwright instance per server process for speed and determinism
- **Project-agnostic**: Configure via hooks module - no hard-coded app knowledge
- **CSS provenance**: Trace computed styles to their source (file, line, selector, !important)
- **Element inspection**: Get box model, attributes, computed styles, and ARIA roles
- **Console capture**: Automatic capture of all browser console output with memory-safe circular buffer
- **Scenario-based hooks**: Support different startup modes (guest, logged-in, etc.)
- **Security**: Origin allowlists, idle timeouts, no exposed debugging ports

## Installation

### From the package index
```bash
npm install mcp-browser-devtools
```

### From source
_This will allow you to run `mcp-browser-devtools` from the command line on your system._

```bash
npm i
npm run build
npm link
```


**Note**: This package has a peer dependency on `playwright`. Make sure Playwright is installed in your project:

```bash
npm install playwright

# Get the list of system dependencies to install for playwright to be able to run.
# You can apt install these.
npm exec playwright -- install-deps --dry-run

# Install the browser.
npm exec playwright -- install
```

## Quick Start

### Config-Free Mode (Simplest)

For quick browser automation without any setup:

```bash
npx mcp-browser-devtools
```

Then use the MCP tool to start a browser:

```json
{
  "tool": "devtools.session.start",
  "arguments": {
    "interactive": true
  }
}
```

This opens a visible browser with a blank page. You can manually navigate anywhere, then use other MCP tools to inspect or interact with the page. Optionally include `"url": "https://example.com"` to navigate automatically.

No configuration file or hooks needed! Perfect for one-off tasks or when you don't have an existing project setup.

### Config-Based Mode (For Projects)

For project-specific scenarios with custom hooks:

1. **Create a configuration file** (`mcp-browser-devtools.config.json`):

```json
{
  "playwright": {
    "baseURL": "http://localhost:3000",
    "headless": true
  },
  "hooks": {
    "modulePath": "./devtools-hooks.js",
    "scenarios": {
      "default": {
        "use": "startDefault",
        "description": "Start the app as a guest user on the homepage"
      },
      "loggedIn": {
        "use": "startLoggedIn",
        "description": "Start the app with a logged-in test user on the dashboard"
      },
      "mobile": {
        "use": "startMobile",
        "description": "Start the app on an iPhone 13 mobile browser",
        "device": "iPhone 13"
      }
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

export async function startMobile({ page, baseURL }) {
  // Navigate to homepage (device emulation is already configured)
  await page.goto(baseURL);

  return {
    stop: async () => {
      // Cleanup if needed
    }
  };
}
```

3. **Run the MCP server**:

```bash
npx mcp-browser-devtools --config mcp-browser-devtools.config.json
```

## MCP Tools

### `devtools.session.start`

Start a new Playwright browser session.

**Parameters:**
- `scenario` (optional): Scenario name to run specific hooks (requires config file with scenarios)
- `interactive` (optional): Launch browser in headed mode (visible window) for manual user interaction (default: false)
- `url` (optional): URL to navigate to after launching browser

**Config-Free Mode Examples:**
```json
// Launch headed browser and navigate to URL
{
  "interactive": true,
  "url": "https://example.com"
}

// Launch headed browser with blank page (user navigates manually)
{
  "interactive": true
}

// Launch headless browser at URL
{
  "url": "https://example.com"
}
```

**Config-Based Mode Example:**
```json
{
  "scenario": "loggedIn",
  "interactive": false
}
```

**Note:**
- When no `scenario` is specified, the browser launches directly without running hooks (config-free mode)
- The `url` parameter is completely optional - omit it to start with a blank browser
- When a `scenario` is specified, a config file with scenarios is required
- Starting a new session automatically stops any previously active session
- The tool description dynamically includes available scenarios when a config file is loaded

### Interactive/Headed Mode

By default, the browser runs in headless mode (invisible). Setting `interactive: true` launches a visible browser window that you can interact with manually before, during, or between automated operations.

**Use Cases:**
- **Complex authentication**: Manually handle OAuth flows, 2FA, CAPTCHAs
- **Debugging**: Watch the browser execute actions in real-time
- **Hybrid workflows**: Manually navigate to a specific state, then use MCP tools for inspection/automation
- **Visual verification**: See exactly what the automated tools are working with

**Workflow:**
1. Start a session with `interactive: true`
2. The browser window opens visibly (and runs your scenario hook if provided)
3. Manually interact with the browser (navigate, login, fill forms, etc.)
4. Tell the LLM to use any MCP tools on the current browser state
5. Continue alternating between manual interaction and automated operations as needed

**Config-Free Examples:**
```
Example 1: Open blank browser, user navigates manually
User: "Start a headed browser"
LLM: Calls devtools.session.start with { interactive: true }
[Browser window opens with blank page]
User: [Manually navigates to GitHub and logs in]
User: "Get the computed styles for the .header element"
LLM: Calls devtools.getElement on current page

Example 2: Open browser at specific URL
User: "Start a headed browser at https://github.com"
LLM: Calls devtools.session.start with { interactive: true, url: "https://github.com" }
[Browser window opens at GitHub]
User: [Manually logs in]
User: "Click the profile button"
LLM: Calls devtools.page.interact to click the button
```

**Config-Based Example:**
```
User: "Start an interactive browser session with the default scenario"
LLM: Calls devtools.session.start with { scenario: "default", interactive: true }
[Browser window opens visibly and runs your scenario hook]
User: "Click the profile button"
LLM: Calls devtools.page.interact to click the button
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

### `devtools.page.screenshot`

Take a screenshot of the current page and save it to a temporary file.

**Parameters:**
- `fullPage` (optional): Capture the full scrollable page instead of just the viewport (default: false)
- `type` (optional): Image format - `"png"` or `"jpeg"` (default: "png")
- `quality` (optional): JPEG quality from 0-100 (only applies to jpeg type, default: 80)

**Example:**
```json
{
  "fullPage": true,
  "type": "png"
}
```

**Response:**
```json
{
  "screenshotPath": "/tmp/mcp-browser-devtools-screenshot-1727832845123.png"
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

### `devtools.page.evaluateJavaScript`

Execute arbitrary JavaScript code in the browser context and return the result. The code can include functions, async operations, loops, and complex logic. This is useful for extracting data, parsing page content, accessing application state, or performing complex DOM queries that aren't easily done with selectors.

**Parameters:**
- `code` (required): JavaScript code to execute in the browser context
- `timeout` (optional): Timeout in milliseconds (default: 30000)

**Return Value:**
The return value must be JSON-serializable (primitives, objects, arrays). Cannot return DOM elements, functions, or non-serializable objects.

**Example 1: Extract all link URLs**
```json
{
  "code": "const links = document.querySelectorAll('a[href]'); return Array.from(links).map(a => ({ text: a.textContent.trim(), url: a.href }));"
}
```

**Example 2: Parse product data with helper functions**
```json
{
  "code": "function parsePrice(text) { return parseFloat(text.replace(/[^0-9.]/g, '')); } function extractProduct(el) { return { name: el.querySelector('.name')?.textContent, price: parsePrice(el.querySelector('.price')?.textContent || '0'), inStock: !el.classList.contains('out-of-stock') }; } const products = document.querySelectorAll('.product-card'); return Array.from(products).map(extractProduct);"
}
```

**Example 3: Aggregate table data**
```json
{
  "code": "const table = document.querySelector('table'); const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent); const rows = Array.from(table.querySelectorAll('tbody tr')); return rows.map(row => { const cells = row.querySelectorAll('td'); return headers.reduce((obj, header, i) => { obj[header] = cells[i]?.textContent; return obj; }, {}); });"
}
```

**Response:**
```json
{
  "result": [/* your data here */],
  "ok": true
}
```

### `devtools.console.getLogs`

Get console messages captured from the browser. The server automatically captures all console output (log, warn, error, info, debug) when a session is active. Messages are stored in a circular buffer, so when the limit is reached, the oldest messages are automatically dropped.

**Parameters:**
- `level` (optional): Filter by log level - `"log"`, `"warn"`, `"error"`, `"info"`, or `"debug"` (default: return all levels)
- `limit` (optional): Maximum number of recent messages to return (default: return all captured messages)
- `search` (optional): Filter messages containing this text (case-insensitive substring match)

**Example 1: Get all captured console messages**
```json
{}
```

**Example 2: Get only error messages**
```json
{
  "level": "error"
}
```

**Example 3: Get last 10 warnings**
```json
{
  "level": "warn",
  "limit": 10
}
```

**Example 4: Search for specific text**
```json
{
  "search": "failed to fetch"
}
```

**Response:**
```json
{
  "messages": [
    {
      "type": "log",
      "text": "User logged in successfully",
      "timestamp": 1727832845123,
      "args": ["User logged in successfully"]
    },
    {
      "type": "error",
      "text": "Failed to fetch /api/data",
      "timestamp": 1727832846456,
      "args": ["Failed to fetch /api/data"]
    }
  ],
  "totalMessages": 2
}
```

**Notes:**
- Console capture is enabled by default with a 1000 message buffer
- Messages from page loads, navigation, and all browser activity are captured
- The circular buffer prevents memory issues when console is spammed
- You can configure buffer size and enable/disable capture in the config file

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
  - Each scenario must have a `use` field specifying the hook function name
  - Each scenario can optionally have a `description` field to help the LLM choose which scenario to use
  - Each scenario can optionally have a `device` field to specify Playwright device emulation (e.g., `"iPhone 13"`, `"Pixel 7"`, `"iPad Pro 11"`)
  - Example:
    ```json
    "scenarios": {
      "default": {
        "use": "startDefault",
        "description": "Start the app as a guest user on the homepage"
      },
      "loggedIn": {
        "use": "startLoggedIn",
        "description": "Start with a logged-in test user on the dashboard"
      },
      "mobile": {
        "use": "startMobile",
        "description": "Start on an iPhone 13 mobile browser",
        "device": "iPhone 13"
      }
    }
    ```

### `policy`

- `singleInstance` (optional, default: `true`): Enforce single session
- `idleMs` (optional, default: `300000`): Idle timeout in milliseconds
- `allowedOrigins` (optional): Array of allowed origins for navigation

### `timeouts`

- `navigationMs` (optional, default: `15000`): Navigation timeout
- `queryMs` (optional, default: `8000`): Query timeout

### `console`

- `enabled` (optional, default: `true`): Enable console message capture
- `maxMessages` (optional, default: `1000`): Maximum number of console messages to store in circular buffer. When this limit is reached, oldest messages are automatically dropped to prevent unbounded memory growth.

**Example:**
```json
{
  "console": {
    "enabled": true,
    "maxMessages": 500
  }
}
```

**Notes:**
- Console capture has minimal performance impact
- The circular buffer ensures memory usage is bounded even if the browser logs heavily
- Disable console capture if you don't need it: `"enabled": false`

## Device Emulation

You can configure scenarios to emulate specific mobile devices, tablets, or desktop browsers using Playwright's built-in device registry. This is useful for testing responsive layouts, mobile-specific features, or touch interactions.

### Usage

Add a `device` field to any scenario in your configuration:

```json
{
  "hooks": {
    "modulePath": "./hooks.js",
    "scenarios": {
      "mobile": {
        "use": "startMobile",
        "description": "iPhone 13 mobile browser",
        "device": "iPhone 13"
      },
      "tablet": {
        "use": "startTablet",
        "description": "iPad Pro tablet browser",
        "device": "iPad Pro 11"
      }
    }
  }
}
```

Device emulation automatically configures:
- **Viewport size** - Screen dimensions
- **User agent** - Browser identification string
- **Device scale factor** - Pixel density
- **Touch support** - Enable touch events
- **Mobile mode** - Mobile-specific browser behaviors

### Popular Devices

**iPhones:**
- `iPhone SE`, `iPhone 13`, `iPhone 14`, `iPhone 15` (and Pro/Max/Plus variants)

**iPads:**
- `iPad (gen 11)`, `iPad Pro 11`, `iPad Mini`

**Android Phones:**
- `Pixel 4`, `Pixel 5`, `Pixel 6`, `Pixel 7`
- `Galaxy S24`, `Galaxy A55`

**Android Tablets:**
- `Galaxy Tab S9`, `Nexus 7`, `Nexus 10`

For the complete list of available devices, see [Playwright's device descriptors](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/deviceDescriptorsSource.json).

### Example Hook

When using device emulation, your hook receives a page that's already configured for the device:

```javascript
export async function startMobile({ page, baseURL }) {
  // Browser is already in iPhone 13 mode
  await page.goto(baseURL);

  // Touch interactions work automatically
  await page.tap('.mobile-menu-button');

  return {};
}
```

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
- `JS_EXECUTION_ERROR`: JavaScript execution failed
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
- **v2**: Richer accessibility queries, optional Puppeteer adapter

## License

MIT

