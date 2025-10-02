import { tmpdir } from "os";
import { join } from "path";
import { writeFileSync } from "fs";
import type { ScreenshotParams, ScreenshotResult } from "../types.js";
import { ErrorCode, createError } from "../errors.js";
import { sessionManager } from "../session/manager.js";

/**
 * Take a screenshot of the current page and save it to a temp file
 */
export async function screenshot(
  params: ScreenshotParams,
): Promise<ScreenshotResult> {
  const session = sessionManager.getSession();

  try {
    // Generate temp file path
    const timestamp = Date.now();
    const extension = params.type === "jpeg" ? "jpg" : "png";
    const filename = `mcp-browser-devtools-screenshot-${timestamp}.${extension}`;
    const screenshotPath = join(tmpdir(), filename);

    // Take screenshot
    const buffer = await session.page.screenshot({
      fullPage: params.fullPage ?? false,
      quality: params.type === "jpeg" ? params.quality : undefined,
      type: params.type ?? "png",
    });

    // Write to temp file
    writeFileSync(screenshotPath, buffer);

    // Touch session to reset idle timer
    sessionManager.touchSession();

    return {
      screenshotPath,
    };
  } catch (err) {
    throw createError(
      ErrorCode.UNEXPECTED_ERROR,
      `Failed to take screenshot: ${err}`,
      { originalError: String(err) },
    );
  }
}
