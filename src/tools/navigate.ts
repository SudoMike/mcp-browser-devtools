import type { NavigateParams, NavigateResult } from '../types.js';
import { ErrorCode, createError } from '../errors.js';
import { sessionManager } from '../session/manager.js';
import { isOriginAllowed } from '../config.js';

/**
 * Navigate the page to a URL
 */
export async function navigate(params: NavigateParams): Promise<NavigateResult> {
  const session = sessionManager.getSession();

  // Resolve URL (may be relative to baseURL)
  let resolvedUrl: string;
  try {
    if (params.url.startsWith('http://') || params.url.startsWith('https://')) {
      resolvedUrl = params.url;
    } else if (session.config.playwright.baseURL) {
      resolvedUrl = new URL(params.url, session.config.playwright.baseURL).href;
    } else {
      resolvedUrl = params.url;
    }
  } catch (err) {
    throw createError(
      ErrorCode.UNEXPECTED_ERROR,
      `Invalid URL: ${params.url}`,
      { originalError: String(err) }
    );
  }

  // Check allowed origins
  if (!isOriginAllowed(resolvedUrl, session.config.policy.allowedOrigins)) {
    throw createError(
      ErrorCode.NAVIGATION_BLOCKED_BY_POLICY,
      `Navigation to ${resolvedUrl} is blocked by policy`,
      {
        url: resolvedUrl,
        allowedOrigins: session.config.policy.allowedOrigins
      }
    );
  }

  // Navigate with timeout
  try {
    const waitUntil = params.wait || 'networkidle';
    await session.page.goto(resolvedUrl, {
      waitUntil,
      timeout: session.config.timeouts.navigationMs,
    });

    // Touch session to reset idle timer
    sessionManager.touchSession();

    return {
      finalUrl: session.page.url(),
    };
  } catch (err) {
    // Check if it's a timeout error
    if (String(err).includes('Timeout') || String(err).includes('timeout')) {
      throw createError(
        ErrorCode.NAVIGATION_TIMEOUT,
        `Navigation to ${resolvedUrl} timed out after ${session.config.timeouts.navigationMs}ms`,
        { originalError: String(err) }
      );
    }

    throw createError(
      ErrorCode.UNEXPECTED_ERROR,
      `Navigation failed: ${err}`,
      { originalError: String(err) }
    );
  }
}
