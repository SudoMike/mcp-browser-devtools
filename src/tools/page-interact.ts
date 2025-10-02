import type {
  PageInteractParams,
  PageInteractResult,
  PageAction,
} from "../types.js";
import type { Page } from "playwright";
import { ErrorCode, createError } from "../errors.js";
import { sessionManager } from "../session/manager.js";

/**
 * Execute a sequence of page interactions
 */
export async function pageInteract(
  params: PageInteractParams,
): Promise<PageInteractResult> {
  const session = sessionManager.getSession();

  if (!session) {
    throw createError(
      ErrorCode.NO_ACTIVE_SESSION,
      "No active session. Call devtools.session.start first.",
    );
  }

  const { page } = session;

  // Execute each action sequentially
  for (let i = 0; i < params.actions.length; i++) {
    const action = params.actions[i];

    try {
      await executeAction(page, action);
    } catch (err) {
      // Return detailed error information
      return {
        ok: false,
        failedAtIndex: i,
        error: err instanceof Error ? err.message : String(err),
        action: action,
      };
    }
  }

  return { ok: true };
}

/**
 * Execute a single page action
 */
async function executeAction(page: Page, action: PageAction): Promise<void> {
  // Default timeout for actions (5 seconds)
  const DEFAULT_TIMEOUT = 5000;

  switch (action.type) {
    case "click":
      await page.click(action.selector, {
        timeout: DEFAULT_TIMEOUT,
        ...action.options,
      });
      break;

    case "fill":
      await page.fill(action.selector, action.value, {
        timeout: DEFAULT_TIMEOUT,
      });
      break;

    case "type":
      await page.type(action.selector, action.text, {
        timeout: DEFAULT_TIMEOUT,
        ...action.options,
      });
      break;

    case "press":
      await page.press(action.selector, action.key, {
        timeout: DEFAULT_TIMEOUT,
        ...action.options,
      });
      break;

    case "select":
      await page.selectOption(action.selector, action.values, {
        timeout: DEFAULT_TIMEOUT,
      });
      break;

    case "wait":
      await page.waitForTimeout(action.delay);
      break;

    case "waitForSelector":
      await page.waitForSelector(action.selector, {
        timeout: DEFAULT_TIMEOUT,
        ...action.options,
      });
      break;

    case "waitForNavigation":
      await page.waitForLoadState(action.options?.waitUntil || "networkidle", {
        timeout: action.options?.timeout || DEFAULT_TIMEOUT,
      });
      break;

    default:
      // TypeScript should prevent this, but handle it at runtime
      throw new Error(
        `Unknown action type: ${(action as PageAction & { type: string }).type}`,
      );
  }
}
