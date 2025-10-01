import type { SessionStartParams, SessionStartResult } from "../types.js";
import type { LoadedConfig } from "../config.js";
import { ErrorCode, createError, isDevToolsError } from "../errors.js";
import { sessionManager } from "../session/manager.js";
import { loadHooksModule, executeHook } from "../session/hooks.js";

/**
 * Start a new Playwright session
 */
export async function sessionStart(
  params: SessionStartParams,
  loadedConfig: LoadedConfig,
): Promise<SessionStartResult> {
  // Check if session already exists
  if (sessionManager.hasSession()) {
    throw createError(
      ErrorCode.ALREADY_STARTED,
      "Session is already active. Call devtools.session.stop first.",
    );
  }

  // Check if start is in progress
  if (sessionManager.isStarting()) {
    throw createError(
      ErrorCode.SESSION_START_IN_PROGRESS,
      "Session start is already in progress",
    );
  }

  // Mark start as in progress
  sessionManager.markStartInProgress();

  try {
    let hookStopFn: (() => void | Promise<void>) | undefined;

    // Execute scenario hook if configured
    if (params.scenario && loadedConfig.hooks) {
      const scenarioConfig = loadedConfig.hooks.scenarios?.[params.scenario];

      if (!scenarioConfig) {
        throw createError(
          ErrorCode.HOOKS_START_FAILED,
          `Scenario '${params.scenario}' not found in configuration`,
          {
            availableScenarios: loadedConfig.hooks.scenarios
              ? Object.keys(loadedConfig.hooks.scenarios)
              : [],
          },
        );
      }

      // Load hooks module
      const hooksModule = await loadHooksModule(loadedConfig.hooks.modulePath);

      // Execute hook without page first (for startup)
      const hookContext = {
        projectRoot: loadedConfig.configDir,
        env: process.env as Record<string, string>,
        baseURL: loadedConfig.resolved.playwright.baseURL,
      };

      const result = await executeHook(
        hooksModule,
        scenarioConfig.use,
        hookContext,
      );
      hookStopFn = result.stop;
    }

    // Create Playwright session
    const session = await sessionManager.createPlaywrightSession(
      loadedConfig.resolved,
      hookStopFn,
    );

    // If we have a hook and it needs the page, execute it again with page
    if (params.scenario && loadedConfig.hooks) {
      const scenarioConfig = loadedConfig.hooks.scenarios?.[params.scenario];
      if (scenarioConfig) {
        const hooksModule = await loadHooksModule(
          loadedConfig.hooks.modulePath,
        );

        const hookContextWithPage = {
          page: session.page,
          projectRoot: loadedConfig.configDir,
          env: process.env as Record<string, string>,
          baseURL: loadedConfig.resolved.playwright.baseURL,
        };

        const result = await executeHook(
          hooksModule,
          scenarioConfig.use,
          hookContextWithPage,
        );

        // Update stop function if hook returned a new one
        if (result.stop) {
          session.hookStopFn = result.stop;
        }
      }
    }

    // Set session as active
    sessionManager.setSession(session);

    return { ok: true };
  } catch (err) {
    // Reset start in progress flag
    sessionManager.markStartInProgress();

    if (isDevToolsError(err)) {
      throw err;
    }

    throw createError(
      ErrorCode.UNEXPECTED_ERROR,
      "Unexpected error during session start",
      { originalError: String(err) },
    );
  }
}
