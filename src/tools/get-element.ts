import type {
  GetElementParams,
  GetElementResult,
  ElementInfo,
} from "../types.js";
import { ErrorCode, createError } from "../errors.js";
import { sessionManager } from "../session/manager.js";
import {
  resolveElementTargets,
  getElementAttributes,
  getElementBoxModel,
  getNodeName,
} from "../cdp/dom.js";
import { getComputedStyles, DEFAULT_COMPUTED_PROPERTIES } from "../cdp/css.js";

/**
 * Get element information
 */
export async function getElement(
  params: GetElementParams,
): Promise<GetElementResult> {
  const session = sessionManager.getSession();
  const maxResults = Math.min(params.maxResults ?? 10, 50); // Cap at 50

  try {
    // Resolve element targets
    const nodeIds = await resolveElementTargets(
      session.cdpSession,
      params.target,
      maxResults,
    );

    if (nodeIds.length === 0) {
      throw createError(
        ErrorCode.ELEMENT_NOT_FOUND,
        `No elements found matching target`,
        { target: params.target },
      );
    }

    // Touch session to reset idle timer
    sessionManager.touchSession();

    // Collect info for each matched element
    const results: ElementInfo[] = [];

    for (const nodeId of nodeIds) {
      const info: ElementInfo = {
        exists: true,
      };

      // Get node name
      info.nodeName = await getNodeName(session.cdpSession, nodeId);

      // Get requested facts
      const include = params.include || {};

      if (include.attributes) {
        info.attributes = await getElementAttributes(
          session.cdpSession,
          nodeId,
        );
      }

      if (include.boxModel) {
        info.boxModel = await getElementBoxModel(session.cdpSession, nodeId);
      }

      if (include.computed) {
        // Expand "ALL_DEFAULTS" and build property list
        let properties: string[] = [];
        for (const prop of include.computed) {
          if (prop === "ALL_DEFAULTS") {
            properties.push(...DEFAULT_COMPUTED_PROPERTIES);
          } else {
            properties.push(prop);
          }
        }

        info.computed = await getComputedStyles(
          session.cdpSession,
          nodeId,
          properties,
        );
      }

      if (include.role) {
        // Try to get role from attributes first
        if (info.attributes && info.attributes.role) {
          info.role = info.attributes.role;
        } else {
          // Heuristic role detection based on element type
          info.role = inferRole(info.nodeName, info.attributes);
        }
      }

      results.push(info);
    }

    return {
      matchCount: nodeIds.length,
      results,
    };
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "error" in err &&
      typeof (err as { error: unknown }).error === "object" &&
      (err as { error: unknown }).error !== null &&
      "code" in (err as { error: { code: unknown } }).error
    ) {
      throw err;
    }

    // Check for timeout
    if (String(err).includes("Timeout") || String(err).includes("timeout")) {
      throw createError(
        ErrorCode.QUERY_TIMEOUT,
        `Query timed out after ${session.config.timeouts.queryMs}ms`,
        { originalError: String(err) },
      );
    }

    throw createError(
      ErrorCode.UNEXPECTED_ERROR,
      `Failed to get element: ${err}`,
      { originalError: String(err) },
    );
  }
}

/**
 * Infer ARIA role based on element type and attributes
 */
function inferRole(
  nodeName?: string,
  attributes?: Record<string, string>,
): string | undefined {
  if (!nodeName) {
    return undefined;
  }

  const tagName = nodeName.toLowerCase();

  // Standard HTML role mappings
  const roleMap: Record<string, string> = {
    a: "link",
    button: "button",
    input: inferInputRole(attributes?.type),
    select: "combobox",
    textarea: "textbox",
    img: "img",
    nav: "navigation",
    main: "main",
    header: "banner",
    footer: "contentinfo",
    section: "region",
    article: "article",
    aside: "complementary",
    form: "form",
    table: "table",
    ul: "list",
    ol: "list",
    li: "listitem",
    h1: "heading",
    h2: "heading",
    h3: "heading",
    h4: "heading",
    h5: "heading",
    h6: "heading",
  };

  return roleMap[tagName];
}

/**
 * Infer role for input elements based on type
 */
function inferInputRole(type?: string): string {
  if (!type) {
    return "textbox";
  }

  const inputRoleMap: Record<string, string> = {
    button: "button",
    checkbox: "checkbox",
    radio: "radio",
    text: "textbox",
    email: "textbox",
    password: "textbox",
    search: "searchbox",
    tel: "textbox",
    url: "textbox",
    number: "spinbutton",
    range: "slider",
  };

  return inputRoleMap[type.toLowerCase()] || "textbox";
}
