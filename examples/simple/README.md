# Simple Example

This example demonstrates the basic usage of MCP DevTools with minimal configuration.

## Setup

1. **Copy the example configuration**:

```bash
cd examples/simple
cp config.json my-config.json
```

2. **Edit `my-config.json`** to match your application:

```json
{
  "playwright": {
    "baseURL": "http://localhost:3000",  // Your app URL
    "headless": true
  },
  "hooks": {
    "modulePath": "./hooks.js",
    "scenarios": {
      "default": { "use": "startDefault" },
      "loggedIn": { "use": "startLoggedIn" }
    }
  },
  "policy": {
    "allowedOrigins": ["http://localhost:3000"]  // Your app origin
  }
}
```

3. **Customize `hooks.js`** for your app's login flow:

```javascript
export async function startLoggedIn({ page, baseURL, env }) {
  if (baseURL) {
    // Replace with your actual login flow
    await page.goto(baseURL + '/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  }

  return { stop: async () => {} };
}
```

## Usage

### Start MCP Server

```bash
npx mcp-devtools --config examples/simple/my-config.json
```

The server will run on stdio and communicate via MCP protocol.

### Example Tool Calls

**Start session (logged in):**
```json
{
  "name": "devtools.session.start",
  "arguments": {
    "scenario": "loggedIn"
  }
}
```

**Navigate to a page:**
```json
{
  "name": "devtools.session.navigate",
  "arguments": {
    "url": "/dashboard",
    "wait": "networkidle"
  }
}
```

**Inspect an element:**
```json
{
  "name": "devtools.getElement",
  "arguments": {
    "target": {
      "kind": "selector",
      "value": ".primary-button"
    },
    "include": ["boxModel", "computed", "attributes", "role"]
  }
}
```

**Get CSS provenance:**
```json
{
  "name": "devtools.getCssProvenance",
  "arguments": {
    "target": {
      "kind": "id",
      "value": "header"
    },
    "property": "border-top-width",
    "includeContributors": true
  }
}
```

**Stop session:**
```json
{
  "name": "devtools.session.stop",
  "arguments": {}
}
```

## Tips

- Use `headless: false` during development to see what the browser is doing
- Check `console.error()` output from hooks for debugging
- Use the `default` scenario if you don't need login
- Set `allowedOrigins` to prevent accidental navigation to external sites
- The session auto-stops after 5 minutes of inactivity (configurable via `policy.idleMs`)

## Troubleshooting

### "NO_ACTIVE_SESSION" error
- Call `devtools.session.start` first before using other tools

### "NAVIGATION_BLOCKED_BY_POLICY" error
- Add the URL's origin to `policy.allowedOrigins` in your config

### Hook errors
- Check that `hooks.modulePath` is relative to the config file
- Ensure your hooks module exports the functions named in `scenarios`
- Check stderr for hook console.error() output

### "Property is a shorthand" error
- Use longhand CSS properties: `border-top-width` instead of `border`
- Common longhands: `margin-top`, `padding-left`, `border-bottom-style`, etc.
