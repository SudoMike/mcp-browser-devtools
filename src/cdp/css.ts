import type { CDPSession } from "playwright";
import type { CDPComputedStyle } from "../types.js";
import { ErrorCode, createError } from "../errors.js";

/**
 * Get computed styles for a node
 */
export async function getComputedStyles(
  cdpSession: CDPSession,
  nodeId: number,
  properties?: string[],
): Promise<Record<string, string>> {
  try {
    const { computedStyle } = await cdpSession.send(
      "CSS.getComputedStyleForNode",
      {
        nodeId,
      },
    );

    const result: Record<string, string> = {};

    for (const style of computedStyle as CDPComputedStyle[]) {
      // If properties filter is provided, only include those
      if (!properties || properties.includes(style.name)) {
        result[style.name] = style.value;
      }
    }

    return result;
  } catch (err) {
    throw createError(
      ErrorCode.CSS_DOMAIN_UNAVAILABLE,
      `Failed to get computed styles: ${err}`,
      { nodeId, originalError: String(err) },
    );
  }
}

/**
 * Get matched CSS rules for a node
 */
export async function getMatchedStyles(
  cdpSession: CDPSession,
  nodeId: number,
): Promise<unknown> {
  try {
    const result = await cdpSession.send("CSS.getMatchedStylesForNode", {
      nodeId,
    });

    return result;
  } catch (err) {
    throw createError(
      ErrorCode.CSS_DOMAIN_UNAVAILABLE,
      `Failed to get matched styles: ${err}`,
      { nodeId, originalError: String(err) },
    );
  }
}

/**
 * Get stylesheet text
 */
export async function getStyleSheetText(
  cdpSession: CDPSession,
  styleSheetId: string,
): Promise<string | null> {
  try {
    const { text } = await cdpSession.send("CSS.getStyleSheetText", {
      styleSheetId,
    });
    return text;
  } catch {
    return null;
  }
}

/**
 * Extract a snippet from stylesheet text around a line/column
 */
export function extractSnippet(
  text: string,
  line: number,
  column: number,
  contextLines: number = 0,
): string {
  const lines = text.split("\n");

  if (line < 0 || line >= lines.length) {
    return "";
  }

  const startLine = Math.max(0, line - contextLines);
  const endLine = Math.min(lines.length - 1, line + contextLines);

  const snippet = lines.slice(startLine, endLine + 1).join("\n");

  return snippet;
}

/**
 * Default high-value computed properties for element inspection
 */
export const DEFAULT_COMPUTED_PROPERTIES = [
  "display",
  "position",
  "width",
  "height",
  "top",
  "right",
  "bottom",
  "left",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "font-size",
  "font-family",
  "font-weight",
  "line-height",
  "color",
  "background-color",
  "z-index",
  "opacity",
  "visibility",
  "overflow",
  "flex-direction",
  "justify-content",
  "align-items",
];
