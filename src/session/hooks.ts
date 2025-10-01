import { pathToFileURL } from "url";
import type { HooksModule, HookContext, HookResult } from "../types.js";
import { ErrorCode, createError } from "../errors.js";

/**
 * Load hooks module from file path
 */
export async function loadHooksModule(
  modulePath: string,
): Promise<HooksModule> {
  try {
    const moduleUrl = pathToFileURL(modulePath).href;
    const module = await import(moduleUrl);
    return module;
  } catch (err) {
    throw createError(
      ErrorCode.HOOKS_START_FAILED,
      `Failed to load hooks module from ${modulePath}`,
      { originalError: String(err) },
    );
  }
}

/**
 * Execute a hook function from the loaded module
 */
export async function executeHook(
  hooksModule: HooksModule,
  hookName: string,
  context: HookContext,
): Promise<HookResult> {
  const hookFn = hooksModule[hookName];

  if (!hookFn || typeof hookFn !== "function") {
    throw createError(
      ErrorCode.HOOKS_START_FAILED,
      `Hook function '${hookName}' not found or not a function in hooks module`,
      {
        availableHooks: Object.keys(hooksModule).filter(
          (k) => typeof hooksModule[k] === "function",
        ),
      },
    );
  }

  try {
    const result = await hookFn(context);
    return result || {};
  } catch (err) {
    throw createError(
      ErrorCode.HOOKS_START_FAILED,
      `Hook function '${hookName}' threw an error`,
      { originalError: String(err) },
    );
  }
}

/**
 * Execute stop function if present
 */
export async function executeStopHook(
  stopFn?: () => void | Promise<void>,
): Promise<void> {
  if (!stopFn) {
    return;
  }

  try {
    await stopFn();
  } catch (err) {
    throw createError(
      ErrorCode.HOOKS_STOP_FAILED,
      "Hook stop function threw an error",
      { originalError: String(err) },
    );
  }
}
