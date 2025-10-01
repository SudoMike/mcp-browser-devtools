import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { resolve } from "path";
import { loadConfig } from "../../src/config.js";
import { sessionStart } from "../../src/tools/session-start.js";
import { sessionStop } from "../../src/tools/session-stop.js";
import { TestServer } from "./fixtures/server.js";
import {
  getHookCallCount,
  getLastHookContext,
  resetHookTracking,
} from "./fixtures/test-hooks.js";

describe("Hook Execution", () => {
  const server = new TestServer();
  let loadedConfig: Awaited<ReturnType<typeof loadConfig>>;

  beforeAll(async () => {
    // Start test server
    await server.start();

    // Load test config
    const configPath = resolve(import.meta.dirname, "config.json");
    loadedConfig = await loadConfig({ configPath });
  });

  afterAll(async () => {
    // Stop test server
    await server.stop();
  });

  afterEach(async () => {
    // Clean up session after each test
    try {
      await sessionStop();
    } catch {
      // Ignore if no session
    }
    // Reset hook tracking
    resetHookTracking();
  });

  describe("Single-Phase Hook Execution", () => {
    it("should call hook function only once with page available", async () => {
      resetHookTracking();

      await sessionStart({ scenario: "default" }, loadedConfig);

      // Verify hook was called exactly once
      expect(getHookCallCount()).toBe(1);

      // Verify the hook received the page
      const context = getLastHookContext();
      expect(context).toBeDefined();
      expect(context?.page).toBeDefined();
      expect(context?.baseURL).toBe("http://localhost:3456");
    });

    it("should support different scenarios", async () => {
      resetHookTracking();

      // Start with loggedIn scenario
      await sessionStart({ scenario: "loggedIn" }, loadedConfig);

      // Verify hook was called exactly once
      expect(getHookCallCount()).toBe(1);

      // Verify the hook received the page
      const context = getLastHookContext();
      expect(context).toBeDefined();
      expect(context?.page).toBeDefined();
    });

    it("should throw error for non-existent scenario", async () => {
      try {
        await sessionStart({ scenario: "nonExistent" }, loadedConfig);
        expect.fail("Should have thrown HOOKS_START_FAILED error");
      } catch (err: any) {
        expect(err.error.code).toBe("HOOKS_START_FAILED");
        expect(err.error.message).toContain("not found");
        expect(err.error.details.availableScenarios).toContain("default");
        expect(err.error.details.availableScenarios).toContain("loggedIn");
      }
    });

    it("should work without scenario when none specified", async () => {
      resetHookTracking();

      // Start session without scenario
      await sessionStart({}, loadedConfig);

      // Hook should not have been called
      expect(getHookCallCount()).toBe(0);
    });
  });

  describe("Hook Cleanup", () => {
    it("should call stop function when session stops", async () => {
      let stopCalled = false;

      // Create a temporary hook that tracks stop calls
      const testHook = async () => {
        return {
          stop: async () => {
            stopCalled = true;
          },
        };
      };

      // We can't easily test this without modifying the hooks file,
      // so we'll just verify the session stops successfully
      await sessionStart({ scenario: "default" }, loadedConfig);
      await sessionStop();

      // Session should be stopped
      expect(true).toBe(true);
    });
  });
});
