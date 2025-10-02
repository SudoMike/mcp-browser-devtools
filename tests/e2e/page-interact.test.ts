import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { resolve } from "path";
import { loadConfig } from "../../src/config.js";
import { sessionStart } from "../../src/tools/session-start.js";
import { sessionStop } from "../../src/tools/session-stop.js";
import { navigate } from "../../src/tools/navigate.js";
import { pageInteract } from "../../src/tools/page-interact.js";
import { getElement } from "../../src/tools/get-element.js";
import { TestServer } from "./fixtures/server.js";

describe("Page Interact Tool", () => {
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
  });

  describe("Click Action", () => {
    it("should click a button successfully", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/interaction-test.html" });

      const result = await pageInteract({
        actions: [{ type: "click", selector: "#show-delayed" }],
      });

      expect(result.ok).toBe(true);
    });

    it("should fail when clicking non-existent element", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/interaction-test.html" });

      const result = await pageInteract({
        actions: [{ type: "click", selector: "#non-existent" }],
      });

      expect(result.ok).toBe(false);
      expect(result.failedAtIndex).toBe(0);
      expect(result.error).toBeDefined();
      expect(result.action).toEqual({
        type: "click",
        selector: "#non-existent",
      });
    });
  });

  describe("Fill Action", () => {
    it("should fill a text input successfully", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/interaction-test.html" });

      const result = await pageInteract({
        actions: [
          { type: "fill", selector: "#text-input", value: "Hello World" },
        ],
      });

      expect(result.ok).toBe(true);
    });

    it("should fill multiple inputs sequentially", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/interaction-test.html" });

      const result = await pageInteract({
        actions: [
          { type: "fill", selector: "#text-input", value: "John Doe" },
          { type: "fill", selector: "#email-input", value: "john@example.com" },
        ],
      });

      expect(result.ok).toBe(true);
    });
  });

  describe("Select Action", () => {
    it("should select an option from dropdown", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/interaction-test.html" });

      const result = await pageInteract({
        actions: [
          { type: "select", selector: "#select-input", values: "option2" },
        ],
      });

      expect(result.ok).toBe(true);
    });
  });

  describe("Wait Actions", () => {
    it("should wait for a delay", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/interaction-test.html" });

      const startTime = Date.now();

      const result = await pageInteract({
        actions: [{ type: "wait", delay: 500 }],
      });

      const elapsed = Date.now() - startTime;

      expect(result.ok).toBe(true);
      expect(elapsed).toBeGreaterThanOrEqual(450); // Allow some tolerance
    });

    it("should wait for selector to appear", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/interaction-test.html" });

      const result = await pageInteract({
        actions: [
          { type: "click", selector: "#show-delayed" },
          {
            type: "waitForSelector",
            selector: "#delayed-element.visible",
            options: { state: "visible", timeout: 2000 },
          },
        ],
      });

      expect(result.ok).toBe(true);
    });

    it("should fail when waiting for non-appearing element", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/interaction-test.html" });

      const result = await pageInteract({
        actions: [
          {
            type: "waitForSelector",
            selector: "#never-appears",
            options: { state: "visible", timeout: 1000 },
          },
        ],
      });

      expect(result.ok).toBe(false);
      expect(result.failedAtIndex).toBe(0);
      expect(result.error).toBeDefined();
    });
  });

  describe("Complex Interaction Sequences", () => {
    it("should execute a complete form submission sequence", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/interaction-test.html" });

      const result = await pageInteract({
        actions: [
          { type: "fill", selector: "#text-input", value: "Test User" },
          { type: "fill", selector: "#email-input", value: "test@example.com" },
          { type: "select", selector: "#select-input", values: "option1" },
          { type: "click", selector: "#submit-button" },
          { type: "waitForSelector", selector: "#result.visible" },
        ],
      });

      expect(result.ok).toBe(true);
    });

    it("should stop execution at first failed action", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/interaction-test.html" });

      const result = await pageInteract({
        actions: [
          { type: "fill", selector: "#text-input", value: "Test" },
          { type: "click", selector: "#non-existent" }, // This will fail
          { type: "fill", selector: "#email-input", value: "test@example.com" }, // Should not execute
        ],
      });

      expect(result.ok).toBe(false);
      expect(result.failedAtIndex).toBe(1);
      expect(result.error).toBeDefined();
      expect(result.action).toEqual({
        type: "click",
        selector: "#non-existent",
      });
    });
  });

  describe("Type and Press Actions", () => {
    it("should type text with delays", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/interaction-test.html" });

      const result = await pageInteract({
        actions: [
          {
            type: "type",
            selector: "#text-input",
            text: "Typed",
            options: { delay: 50 },
          },
        ],
      });

      expect(result.ok).toBe(true);
    });

    it("should press a key on an element", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/interaction-test.html" });

      const result = await pageInteract({
        actions: [
          { type: "fill", selector: "#text-input", value: "Test" },
          { type: "press", selector: "#text-input", key: "Enter" },
        ],
      });

      expect(result.ok).toBe(true);
    });
  });

  describe("No Active Session Errors", () => {
    it("should throw NO_ACTIVE_SESSION when interacting without session", async () => {
      try {
        await pageInteract({
          actions: [{ type: "click", selector: "#test" }],
        });
        expect.fail("Should have thrown NO_ACTIVE_SESSION error");
      } catch (err: any) {
        expect(err.error.code).toBe("NO_ACTIVE_SESSION");
        expect(err.error.message).toContain("No active session");
      }
    });
  });
});
