import type {
  GetCssProvenanceParams,
  GetCssProvenanceResult,
  CssProvenanceInfo,
} from "../types.js";
import { ErrorCode, createError } from "../errors.js";
import { sessionManager } from "../session/manager.js";
import { resolveElementTargets } from "../cdp/dom.js";
import { getComputedStyles } from "../cdp/css.js";
import { isShorthand, findWinningDeclaration } from "../cdp/cascade.js";

/**
 * Get CSS provenance for a property
 */
export async function getCssProvenance(
  params: GetCssProvenanceParams,
): Promise<GetCssProvenanceResult> {
  const session = sessionManager.getSession();
  const maxResults = Math.min(params.maxResults ?? 10, 50); // Cap at 50

  // Check if property is a shorthand
  if (isShorthand(params.property)) {
    throw createError(
      ErrorCode.UNEXPECTED_ERROR,
      `Property '${params.property}' is a CSS shorthand. Please use the longhand property instead.`,
      {
        property: params.property,
        suggestion:
          "Use specific longhand properties like border-top-width, margin-left, etc.",
      },
    );
  }

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

    // Collect provenance for each matched element
    const results: CssProvenanceInfo[] = [];

    for (const nodeId of nodeIds) {
      // Get computed value
      const computed = await getComputedStyles(session.cdpSession, nodeId, [
        params.property,
      ]);

      const computedValue = computed[params.property] || null;

      // Find winning declaration
      const { winner, contributors } = await findWinningDeclaration(
        session.cdpSession,
        nodeId,
        params.property,
      );

      const info: CssProvenanceInfo = {
        property: params.property,
        computedValue,
      };

      if (winner) {
        info.winner = winner;
      }

      if (
        params.includeContributors &&
        contributors &&
        contributors.length > 0
      ) {
        info.contributors = contributors;
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
      `Failed to get CSS provenance: ${err}`,
      { originalError: String(err) },
    );
  }
}
