import type { CDPSession } from "playwright";
import type {
  CssDeclarationSource,
  CDPProperty,
  CDPMatchedRule,
  CDPRule,
} from "../types.js";
import { getMatchedStyles, getStyleSheetText, extractSnippet } from "./css.js";

/**
 * CSS shorthand to longhand mappings
 */
const SHORTHAND_TO_LONGHAND: Record<string, string[]> = {
  margin: ["margin-top", "margin-right", "margin-bottom", "margin-left"],
  padding: ["padding-top", "padding-right", "padding-bottom", "padding-left"],
  border: [
    "border-top-width",
    "border-right-width",
    "border-bottom-width",
    "border-left-width",
    "border-top-style",
    "border-right-style",
    "border-bottom-style",
    "border-left-style",
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
  ],
  "border-top": ["border-top-width", "border-top-style", "border-top-color"],
  "border-right": [
    "border-right-width",
    "border-right-style",
    "border-right-color",
  ],
  "border-bottom": [
    "border-bottom-width",
    "border-bottom-style",
    "border-bottom-color",
  ],
  "border-left": [
    "border-left-width",
    "border-left-style",
    "border-left-color",
  ],
  "border-width": [
    "border-top-width",
    "border-right-width",
    "border-bottom-width",
    "border-left-width",
  ],
  "border-style": [
    "border-top-style",
    "border-right-style",
    "border-bottom-style",
    "border-left-style",
  ],
  "border-color": [
    "border-top-color",
    "border-right-color",
    "border-bottom-color",
    "border-left-color",
  ],
  background: [
    "background-color",
    "background-image",
    "background-repeat",
    "background-position",
    "background-size",
  ],
  font: [
    "font-style",
    "font-variant",
    "font-weight",
    "font-size",
    "line-height",
    "font-family",
  ],
  flex: ["flex-grow", "flex-shrink", "flex-basis"],
};

/**
 * Check if a property is a shorthand
 */
export function isShorthand(property: string): boolean {
  return property in SHORTHAND_TO_LONGHAND;
}

/**
 * Get longhand properties for a shorthand
 */
export function getLonghands(shorthand: string): string[] | undefined {
  return SHORTHAND_TO_LONGHAND[shorthand];
}

/**
 * Find the winning declaration for a CSS property
 */
export async function findWinningDeclaration(
  cdpSession: CDPSession,
  nodeId: number,
  property: string,
): Promise<{
  winner?: CssDeclarationSource;
  contributors?: CssDeclarationSource[];
}> {
  const matchedStyles = await getMatchedStyles(cdpSession, nodeId);

  const allDeclarations: Array<{
    property: CDPProperty;
    rule: CDPRule | { origin: "inline"; style: typeof matchedStyles.inlineStyle };
    matchedRule?: unknown;
  }> = [];

  // Collect inline styles
  if (matchedStyles.inlineStyle) {
    for (const prop of matchedStyles.inlineStyle.cssProperties || []) {
      if (prop.name === property && !prop.disabled) {
        allDeclarations.push({
          property: prop,
          rule: { origin: "inline", style: matchedStyles.inlineStyle },
        });
      }
    }
  }

  // Collect matched rules
  if (matchedStyles.matchedCSSRules) {
    for (const matchedRule of matchedStyles.matchedCSSRules as CDPMatchedRule[]) {
      const rule = matchedRule.rule;

      for (const prop of rule.style.cssProperties || []) {
        if (prop.name === property && !prop.disabled) {
          allDeclarations.push({
            property: prop,
            rule,
            matchedRule,
          });
        }
      }
    }
  }

  // Check inherited styles (simplified - just note if it might be inherited)
  const inheritedProperties = new Set([
    "color",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "line-height",
    "text-align",
    "text-transform",
    "letter-spacing",
    "word-spacing",
    "white-space",
    "visibility",
    "cursor",
  ]);

  if (allDeclarations.length === 0 && inheritedProperties.has(property)) {
    // Try to find declaration on parent
    // For v1, we'll skip full inheritance chain traversal
    // and just note it might be inherited
  }

  if (allDeclarations.length === 0) {
    return {};
  }

  // Sort by CSS cascade order (proper specificity)
  // CSS Cascade priority: https://developer.mozilla.org/en-US/docs/Web/CSS/Cascade
  // 1. Inline !important
  // 2. Stylesheet !important
  // 3. Inline normal
  // 4. Stylesheet normal (by specificity, then source order)

  const inlineDeclarations = allDeclarations.filter(
    (d) => "origin" in d.rule && d.rule.origin === "inline",
  );
  const stylesheetDeclarations = allDeclarations.filter(
    (d) => !("origin" in d.rule && d.rule.origin === "inline"),
  );

  // Separate by !important
  const inlineImportant = inlineDeclarations.filter((d) => d.property.important);
  const stylesheetImportant = stylesheetDeclarations.filter(
    (d) => d.property.important,
  );
  const inlineNormal = inlineDeclarations.filter((d) => !d.property.important);
  const stylesheetNormal = stylesheetDeclarations.filter(
    (d) => !d.property.important,
  );

  // Pick winner by cascade priority
  let winner;
  if (inlineImportant.length > 0) {
    winner = inlineImportant[inlineImportant.length - 1];
  } else if (stylesheetImportant.length > 0) {
    winner = stylesheetImportant[stylesheetImportant.length - 1];
  } else if (inlineNormal.length > 0) {
    winner = inlineNormal[inlineNormal.length - 1];
  } else {
    winner = stylesheetNormal[stylesheetNormal.length - 1];
  }

  // Convert to CssDeclarationSource
  const winnerSource = await declarationToSource(cdpSession, winner);
  const contributorSources = await Promise.all(
    allDeclarations
      .filter((d) => d !== winner)
      .map((d) => declarationToSource(cdpSession, d)),
  );

  return {
    winner: winnerSource,
    contributors: contributorSources,
  };
}

/**
 * Convert CDP declaration to CssDeclarationSource
 */
async function declarationToSource(
  cdpSession: CDPSession,
  declaration: {
    property: CDPProperty;
    rule: CDPRule | { origin: "inline"; style: unknown };
    matchedRule?: unknown;
  },
): Promise<CssDeclarationSource> {
  const { property, rule } = declaration;

  const isInline = "origin" in rule && rule.origin === "inline";
  const source: CssDeclarationSource = {
    source: isInline ? "inline" : "stylesheet",
    value: property.value,
    important: property.important,
  };

  if (!isInline && "selectorList" in rule) {
    // Add selector
    if (rule.selectorList?.text) {
      source.selector = rule.selectorList.text;
    }

    // Add stylesheet URL and location
    if (rule.style?.styleSheetId) {
      try {
        // Get stylesheet header
        const styleSheetId = rule.style.styleSheetId;

        // Try to get stylesheet text for snippet
        const text = await getStyleSheetText(cdpSession, styleSheetId);

        if (property.range && text) {
          source.line = property.range.startLine;
          source.column = property.range.startColumn;

          // Extract snippet
          const snippet = extractSnippet(
            text,
            property.range.startLine,
            property.range.startColumn,
          );
          if (snippet) {
            source.snippet = snippet.trim();
          }
        }

        // Try to get stylesheet URL from the stylesheet header
        try {
          const result = (await cdpSession.send("CSS.getStyleSheetText", {
            styleSheetId,
          })) as { header?: { sourceURL?: string } };

          if (result.header?.sourceURL) {
            source.stylesheetUrl = result.header.sourceURL;
          }
        } catch {
          // Ignore - stylesheet URL is optional
          // CDP may not provide this in all cases
        }
      } catch {
        // Ignore - source location is best-effort
      }
    }
  }

  return source;
}
