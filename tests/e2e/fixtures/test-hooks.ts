/**
 * Minimal hooks module for testing
 */

import type { HookContext, HookResult } from "../../../src/types.js";

let hookCallCount = 0;
let lastHookContext: HookContext | null = null;

export function getHookCallCount() {
  return hookCallCount;
}

export function getLastHookContext() {
  return lastHookContext;
}

export function resetHookTracking() {
  hookCallCount = 0;
  lastHookContext = null;
}

export async function defaultScenario(
  context: HookContext,
): Promise<HookResult> {
  hookCallCount++;
  lastHookContext = context;

  // Just navigate to base URL if page is available
  if (context.page && context.baseURL) {
    await context.page.goto(context.baseURL);
  }

  return {
    stop: async () => {
      // Cleanup
    },
  };
}

export async function testLogin(context: HookContext): Promise<HookResult> {
  hookCallCount++;
  lastHookContext = context;

  // Navigate and perform a mock login
  if (context.page && context.baseURL) {
    await context.page.goto(context.baseURL + "/multiple-elements.html");
    // Simulate being logged in by navigating to a specific page
  }

  return {
    stop: async () => {
      // Cleanup
    },
  };
}
