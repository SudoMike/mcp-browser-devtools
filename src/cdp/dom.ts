import type { CDPSession } from 'playwright';
import type { ElementTarget } from '../types.js';
import { ErrorCode, createError } from '../errors.js';

/**
 * Simple CSS escape function for IDs
 */
function escapeCSS(str: string): string {
  return str.replace(/([^\w-])/g, '\\$1');
}

/**
 * Resolve element target to node IDs
 * Returns array of node IDs (may be empty if no matches)
 */
export async function resolveElementTargets(
  cdpSession: CDPSession,
  target: ElementTarget,
  maxResults: number = 10
): Promise<number[]> {
  try {
    // Get document root
    const { root } = await cdpSession.send('DOM.getDocument', { depth: 0 });

    if (target.kind === 'id') {
      // Query by ID using CSS selector
      const selector = `#${escapeCSS(target.value)}`;
      const { nodeIds } = await cdpSession.send('DOM.querySelectorAll', {
        nodeId: root.nodeId,
        selector,
      });

      return nodeIds.slice(0, maxResults);
    } else {
      // Query by CSS selector
      const { nodeIds } = await cdpSession.send('DOM.querySelectorAll', {
        nodeId: root.nodeId,
        selector: target.value,
      });

      return nodeIds.slice(0, maxResults);
    }
  } catch (err) {
    throw createError(
      ErrorCode.UNEXPECTED_ERROR,
      `Failed to resolve element target: ${err}`,
      { target, originalError: String(err) }
    );
  }
}

/**
 * Get element attributes
 */
export async function getElementAttributes(
  cdpSession: CDPSession,
  nodeId: number
): Promise<Record<string, string>> {
  try {
    const { attributes } = await cdpSession.send('DOM.getAttributes', { nodeId });

    // CDP returns attributes as flat array: [name1, value1, name2, value2, ...]
    const result: Record<string, string> = {};
    for (let i = 0; i < attributes.length; i += 2) {
      result[attributes[i]] = attributes[i + 1];
    }

    return result;
  } catch (err) {
    return {};
  }
}

/**
 * Get element box model
 */
export async function getElementBoxModel(
  cdpSession: CDPSession,
  nodeId: number
): Promise<any> {
  try {
    const { model } = await cdpSession.send('DOM.getBoxModel', { nodeId });

    // Convert flat quad arrays to structured objects
    const toQuad = (arr: number[]) => ({
      x: arr[0],
      y: arr[1],
      width: arr[4] - arr[0],
      height: arr[5] - arr[1],
    });

    return {
      x: model.content[0],
      y: model.content[1],
      width: model.width,
      height: model.height,
      content: toQuad(model.content),
      padding: toQuad(model.padding),
      border: toQuad(model.border),
      margin: toQuad(model.margin),
    };
  } catch (err) {
    // Element may not have a box model (display: none, detached, etc.)
    return null;
  }
}

/**
 * Get node name
 */
export async function getNodeName(
  cdpSession: CDPSession,
  nodeId: number
): Promise<string | undefined> {
  try {
    const { node } = await cdpSession.send('DOM.describeNode', { nodeId });
    return node.nodeName;
  } catch {
    return undefined;
  }
}
