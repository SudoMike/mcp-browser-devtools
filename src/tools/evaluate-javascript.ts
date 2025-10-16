import type {
  EvaluateJavaScriptParams,
  EvaluateJavaScriptResult,
} from "../types.js";
import { ErrorCode, createError } from "../errors.js";
import { sessionManager } from "../session/manager.js";
import { tmpdir } from "os";
import { writeFileSync } from "fs";
import { join } from "path";

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

    // If saveToFile is true, write result to a file instead of returning it directly
    if (params.saveToFile) {
      const timestamp = Date.now();
      const filename = `mcp-browser-data-${timestamp}.json`;
      const filePath = join(tmpdir(), filename);

      // Serialize the result to JSON
      const jsonContent = JSON.stringify(result, null, 2);
      const resultSize = Buffer.byteLength(jsonContent, "utf8");

      // Write to file
      writeFileSync(filePath, jsonContent, "utf8");

      return {
        resultPath: filePath,
        resultSize,
        ok: true,
      };
    }

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
