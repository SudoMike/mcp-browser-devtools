# MCP DevTools Architecture

This document describes the internal architecture of the MCP DevTools server.

## Overview

MCP DevTools is a stdio-based MCP server that provides browser inspection capabilities through Playwright and Chrome DevTools Protocol (CDP). It maintains a single, long-lived browser session and exposes tools for navigation, element inspection, and CSS provenance analysis.

## Key Design Principles

1. **Project-agnostic**: No hard-coded knowledge of any specific application
2. **Single session**: One Playwright instance per server process for predictability
3. **In-process**: Playwright runs in the same process (no CLI spawning)
4. **Session reuse**: Multiple queries against same page without relaunching
5. **Hooks-driven**: App-specific behavior via configurable hooks module

## Directory Structure

```
src/
├── index.ts              # MCP server entry point, tool handlers
├── config.ts             # Configuration loading and validation
├── errors.ts             # Error codes and factory functions
├── types.ts              # TypeScript type definitions
├── session/
│   ├── manager.ts        # Session lifecycle and singleton enforcement
│   ├── idle-timer.ts     # Idle timeout mechanism
│   └── hooks.ts          # Hook module loading and execution
├── tools/
│   ├── session-start.ts  # Start session tool
│   ├── session-stop.ts   # Stop session tool
│   ├── navigate.ts       # Navigation tool
│   ├── get-element.ts    # Element inspection tool
│   └── get-css-provenance.ts  # CSS provenance tool
└── cdp/
    ├── dom.ts            # DOM node resolution and queries
    ├── css.ts            # CSS computed styles and matched rules
    └── cascade.ts        # CSS cascade resolution and winner selection
```

## Core Components

### Session Manager (`session/manager.ts`)

Singleton that manages the Playwright browser instance:

- Enforces single-instance policy
- Creates/destroys browser/context/page/CDP session
- Manages idle timer
- Coordinates hook lifecycle
- Provides session access to tools

**State transitions:**
```
null -> starting -> active -> null
```

### Idle Timer (`session/idle-timer.ts`)

Simple timer that fires a callback after inactivity:

- Reset on page-using tool calls (navigate, getElement, getCssProvenance)
- NOT reset on session management calls (start, stop)
- Automatically calls `sessionManager.stop()` on timeout

### Hooks System (`session/hooks.ts`)

Dynamic module loader for app-specific behavior:

- Loads hooks module using dynamic `import()`
- Executes named scenario functions
- Calls hooks twice if page is needed:
  1. Without page (for server startup)
  2. With page (for browser actions like login)
- Manages cleanup via returned `stop()` function

### Configuration (`config.ts`)

Loads and validates JSON config:

- Resolves relative paths to config file directory
- Loads optional .env file via dotenv
- Applies sensible defaults
- Validates origin allowlist for navigation

### Error Handling (`errors.ts`)

Uniform error response format:

```typescript
{
  error: {
    code: ErrorCode,
    message: string,
    details?: unknown
  }
}
```

All tools throw DevToolsError which is caught by MCP handler and returned as tool error.

## CDP Integration

### DOM Resolution (`cdp/dom.ts`)

Resolves element targets to CDP node IDs:

- Supports `kind: "id"` (converts to `#id` selector)
- Supports `kind: "selector"` (uses as-is)
- Returns multiple node IDs (up to maxResults)
- Provides helper functions for attributes, box model, node name

### CSS Queries (`cdp/css.ts`)

Queries computed styles and matched rules:

- `getComputedStyles`: CDP `CSS.getComputedStyleForNode`
- `getMatchedStyles`: CDP `CSS.getMatchedStylesForNode`
- `getStyleSheetText`: CDP `CSS.getStyleSheetText` (for snippets)
- Defines default high-value properties for element inspection

### Cascade Resolution (`cdp/cascade.ts`)

Determines winning CSS declaration:

1. Collects all declarations for property (inline + matched rules)
2. Separates `!important` vs normal declarations
3. Selects winner: last `!important` or last normal
4. Traces to source (file, line, column, selector)
5. Extracts code snippet from stylesheet text
6. Returns winner + contributors (if requested)

**Shorthand handling:**
- Detects shorthands via lookup table
- Rejects shorthand queries with helpful error
- LLM must use longhand properties

## Tool Implementation

### session.start

1. Check singleton policy (reject if already started)
2. Mark start in progress
3. Execute scenario hook (if specified) without page
4. Launch Playwright browser
5. Create context (with baseURL, storageState if configured)
6. Create page and CDP session
7. Enable CDP CSS and DOM domains
8. Execute scenario hook with page (if specified)
9. Set session as active
10. Start idle timer

### session.stop

1. Cancel idle timer
2. Detach CDP session
3. Close page, context, browser
4. Call hook `stop()` function
5. Clear session state

### navigate

1. Get active session
2. Resolve URL (relative to baseURL if needed)
3. Check origin allowlist
4. Navigate with configured timeout
5. Touch session (reset idle timer)
6. Return final URL

### getElement

1. Get active session
2. Resolve element targets (up to maxResults)
3. For each matched node:
   - Get node name
   - Get attributes (if requested)
   - Get box model (if requested)
   - Get computed styles (if requested)
   - Infer ARIA role (if requested)
4. Touch session
5. Return matchCount + results array

### getCssProvenance

1. Get active session
2. Check if property is shorthand (reject if so)
3. Resolve element targets (up to maxResults)
4. For each matched node:
   - Get computed value
   - Find winning declaration via cascade resolution
   - Collect contributors (if requested)
5. Touch session
6. Return matchCount + results array

## Lifecycle

### Startup

1. Parse CLI args (`--config <path>`)
2. Load configuration from JSON
3. Load .env file (if configured)
4. Create MCP server
5. Register tool handlers
6. Connect stdio transport
7. Listen for SIGINT/SIGTERM

### Runtime

1. MCP client sends tool call
2. Server routes to appropriate handler
3. Handler uses sessionManager to get session
4. Handler calls CDP/Playwright APIs
5. Handler returns result (or DevToolsError)
6. Idle timer tracks inactivity

### Shutdown

1. Receive SIGINT/SIGTERM or stdio close
2. Call `sessionManager.stop()`
3. Cleanup all resources
4. Exit process

## Threading & Concurrency

- **Single-threaded**: Node.js event loop
- **No concurrency control needed**: MCP is request-response (no concurrent tool calls)
- **Async throughout**: All I/O is async (CDP, Playwright, hooks)

## Security Considerations

1. **Origin allowlist**: Prevents navigation to arbitrary URLs
2. **No remote debugging port**: CDP only accessed in-process
3. **Idle timeout**: Auto-stops abandoned sessions
4. **No secret exposure**: Tools never return cookies, localStorage, etc.
5. **Hooks run in process**: Trust hooks module (app-provided)

## Testing Strategy

- **Unit tests**: Core logic (cascade resolution, config loading)
- **Integration tests**: Full tool calls against real browser
- **Example hooks**: Minimal test fixture for E2E validation

## Future Enhancements (v1.1+)

- Shadow DOM / iframe traversal
- Pseudo-element support (::before, ::after)
- Full Styles pane (all rules, not just winner)
- Screenshot capture tool
- Richer accessibility queries
- Puppeteer adapter (still Playwright-first)
