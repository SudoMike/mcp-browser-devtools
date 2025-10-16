import type {
  EvaluateJavaScriptParams,
  EvaluateJavaScriptResult,
} from "../types.js";
import { ErrorCode, createError } from "../errors.js";
import { sessionManager } from "../session/manager.js";

/**
 * Execute arbitrary JavaScript code in the browser context and return the result.
 * The code can include functions, async operations, and complex logic.
 * The return value must be JSON-serializable.
 */
export async function evaluateJavaScript(
  params: EvaluateJavaScriptParams,
): Promise<EvaluateJavaScriptResult> {
  const session = sessionManager.getSession();

  try {
    // Execute the code in the browser context
    // The code is wrapped in an async function to support await
    const result = await session.page.evaluate(async (code: string) => {
      // Use indirect eval to execute in global scope
      const AsyncFunction = async function () {}
        .constructor as FunctionConstructor;
      const fn = AsyncFunction(code);
      return await fn();
    }, params.code);

    // Touch session to reset idle timer
    sessionManager.touchSession();

    return {
      result,
      ok: true,
    };
  } catch (err) {
    throw createError(
      ErrorCode.JS_EXECUTION_ERROR,
      `JavaScript execution failed: ${err}`,
      { originalError: String(err) },
    );
  }
}
