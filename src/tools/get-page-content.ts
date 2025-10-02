import type { GetPageContentParams, GetPageContentResult } from "../types.js";
import { ErrorCode, createError } from "../errors.js";
import { sessionManager } from "../session/manager.js";

/**
 * Get the raw HTML content from the page
 */
export async function getPageContent(
  params: GetPageContentParams,
): Promise<GetPageContentResult> {
  const session = sessionManager.getSession();

  try {
    // Get full HTML content
    const fullHtml = await session.page.content();
    const fullLength = fullHtml.length;

    // Handle parameters with defaults
    const start = params.start ?? 0;
    const length = params.length ?? -1;

    // Calculate the slice
    let html: string;
    if (length === -1) {
      // Return from start to end
      html = fullHtml.slice(start);
    } else {
      // Return from start with specified length
      html = fullHtml.slice(start, start + length);
    }

    // Touch session to reset idle timer
    sessionManager.touchSession();

    return {
      html,
      fullLength,
    };
  } catch (err) {
    throw createError(
      ErrorCode.UNEXPECTED_ERROR,
      `Failed to get page content: ${err}`,
      { originalError: String(err) },
    );
  }
}
