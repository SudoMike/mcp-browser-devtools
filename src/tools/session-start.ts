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
  loadedConfig: LoadedConfig | null,
): Promise<SessionStartResult> {
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
    // Get scenario config if specified
    let scenarioConfig;
    let deviceName: string | undefined;

    if (params.scenario) {
      if (!loadedConfig?.hooks) {
        throw createError(
          ErrorCode.HOOKS_START_FAILED,
          "Scenario specified but no config file loaded. Start server with --config flag to use scenarios.",
        );
      }

      scenarioConfig = loadedConfig.hooks.scenarios?.[params.scenario];

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

      deviceName = scenarioConfig.device;
    }

    // Build resolved config from loaded config or use defaults
    const resolvedConfig = loadedConfig
      ? { ...loadedConfig.resolved }
      : {
          playwright: {
            baseURL: undefined,
            headless: true,
            storageStatePath: undefined,
            traceOutputPath: undefined,
          },
          policy: {
            singleInstance: true,
            idleMs: 300_000,
            allowedOrigins: undefined,
          },
          timeouts: {
            navigationMs: 15_000,
            queryMs: 8_000,
          },
        };

    // Override headless setting if interactive mode is requested
    if (params.interactive) {
      resolvedConfig.playwright = {
        ...resolvedConfig.playwright,
        headless: false,
      };
    }

    // Create Playwright session with optional device emulation
    const session = await sessionManager.createPlaywrightSession(
      resolvedConfig,
      undefined,
      deviceName,
    );

    // Execute scenario hook if configured
    if (scenarioConfig && loadedConfig?.hooks) {
      // Load hooks module
      const hooksModule = await loadHooksModule(loadedConfig.hooks.modulePath);

      // Execute hook once with page available
      const hookContext = {
        page: session.page,
        baseURL: resolvedConfig.playwright.baseURL,
      };

      const result = await executeHook(
        hooksModule,
        scenarioConfig.use,
        hookContext,
      );

      // Store stop function if hook returned one
      if (result.stop) {
        session.hookStopFn = result.stop;
      }
    }

    // Set session as active (this also clears startInProgress flag)
    sessionManager.setSession(session);

    // Navigate to URL if provided
    if (params.url) {
      try {
        await session.page.goto(params.url, {
          waitUntil: "networkidle",
          timeout: resolvedConfig.timeouts.navigationMs,
        });
      } catch (err) {
        // Don't fail the session start if navigation fails
        // User can manually navigate or use the navigate tool
        console.error(`Warning: Failed to navigate to ${params.url}: ${err}`);
      }
    }

    return { ok: true };
  } catch (err) {
    // Clear start in progress flag on error
    sessionManager.clearStartInProgress();

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
