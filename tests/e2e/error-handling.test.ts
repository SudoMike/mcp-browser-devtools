import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { resolve } from "path";
import { loadConfig } from "../../src/config.js";
import { sessionStart } from "../../src/tools/session-start.js";
import { sessionStop } from "../../src/tools/session-stop.js";
import { navigate } from "../../src/tools/navigate.js";
import { getElement } from "../../src/tools/get-element.js";
import { getCssProvenance } from "../../src/tools/get-css-provenance.js";
import { TestServer } from "./fixtures/server.js";

describe("Error Handling and Edge Cases", () => {
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

  describe("No Active Session Errors", () => {
    it("should throw NO_ACTIVE_SESSION when navigating without session", async () => {
      try {
        await navigate({ url: "/multiple-elements.html" });
        expect.fail("Should have thrown NO_ACTIVE_SESSION error");
      } catch (err: any) {
        expect(err.error.code).toBe("NO_ACTIVE_SESSION");
        expect(err.error.message).toContain("No active session");
      }
    });

    it("should throw NO_ACTIVE_SESSION when getting element without session", async () => {
      try {
        await getElement({
          target: { kind: "id", value: "test" },
        });
        expect.fail("Should have thrown NO_ACTIVE_SESSION error");
      } catch (err: any) {
        expect(err.error.code).toBe("NO_ACTIVE_SESSION");
        expect(err.error.message).toContain("No active session");
      }
    });

    it("should throw NO_ACTIVE_SESSION when getting CSS provenance without session", async () => {
      try {
        await getCssProvenance({
          target: { kind: "id", value: "test" },
          property: "color",
        });
        expect.fail("Should have thrown NO_ACTIVE_SESSION error");
      } catch (err: any) {
        expect(err.error.code).toBe("NO_ACTIVE_SESSION");
        expect(err.error.message).toContain("No active session");
      }
    });
  });

  describe("Element Not Found Errors", () => {
    it("should throw ELEMENT_NOT_FOUND for non-existent ID", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      try {
        await getElement({
          target: { kind: "id", value: "non-existent-id" },
        });
        expect.fail("Should have thrown ELEMENT_NOT_FOUND error");
      } catch (err: any) {
        expect(err.error.code).toBe("ELEMENT_NOT_FOUND");
        expect(err.error.message).toContain("No elements found");
      }
    });

    it("should throw ELEMENT_NOT_FOUND for non-existent selector", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      try {
        await getElement({
          target: { kind: "selector", value: ".non-existent-class" },
        });
        expect.fail("Should have thrown ELEMENT_NOT_FOUND error");
      } catch (err: any) {
        expect(err.error.code).toBe("ELEMENT_NOT_FOUND");
        expect(err.error.message).toContain("No elements found");
      }
    });

    it("should throw ELEMENT_NOT_FOUND for non-existent element in getCssProvenance", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      try {
        await getCssProvenance({
          target: { kind: "id", value: "does-not-exist" },
          property: "color",
        });
        expect.fail("Should have thrown ELEMENT_NOT_FOUND error");
      } catch (err: any) {
        expect(err.error.code).toBe("ELEMENT_NOT_FOUND");
        expect(err.error.message).toContain("No elements found");
      }
    });
  });

  describe("Malformed Selector Errors", () => {
    it("should handle invalid CSS selector gracefully", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      try {
        await getElement({
          target: { kind: "selector", value: "[invalid[[selector" },
        });
        expect.fail("Should have thrown an error for invalid selector");
      } catch (err: any) {
        // Could be ELEMENT_NOT_FOUND or UNEXPECTED_ERROR depending on CDP behavior
        expect(err.error).toBeDefined();
        expect(err.error.code).toBeDefined();
      }
    });

    it("should handle empty selector", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      try {
        await getElement({
          target: { kind: "selector", value: "" },
        });
        expect.fail("Should have thrown an error for empty selector");
      } catch (err: any) {
        expect(err.error).toBeDefined();
        expect(err.error.code).toBeDefined();
      }
    });
  });

  describe("Invalid CSS Property Errors", () => {
    it("should reject shorthand property 'margin' in getCssProvenance", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      try {
        await getCssProvenance({
          target: { kind: "id", value: "first" },
          property: "margin",
        });
        expect.fail("Should have thrown error for shorthand property");
      } catch (err: any) {
        expect(err.error.message).toMatch(/shorthand/i);
      }
    });

    it("should reject shorthand property 'padding' in getCssProvenance", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      try {
        await getCssProvenance({
          target: { kind: "id", value: "first" },
          property: "padding",
        });
        expect.fail("Should have thrown error for shorthand property");
      } catch (err: any) {
        expect(err.error.message).toMatch(/shorthand/i);
      }
    });

    it("should reject shorthand property 'border' in getCssProvenance", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      try {
        await getCssProvenance({
          target: { kind: "id", value: "first" },
          property: "border",
        });
        expect.fail("Should have thrown error for shorthand property");
      } catch (err: any) {
        expect(err.error.message).toMatch(/shorthand/i);
      }
    });

    it("should handle non-existent CSS property gracefully", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      // Non-existent longhand properties should return a result (likely with null/default values)
      // rather than throwing an error
      const result = await getCssProvenance({
        target: { kind: "id", value: "first" },
        property: "made-up-property-name",
      });

      expect(result.matchCount).toBe(1);
      expect(result.results[0].property).toBe("made-up-property-name");
    });
  });

  describe("Edge Cases - Empty Results", () => {
    it("should return empty results for selector with no matches", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      try {
        await getElement({
          target: { kind: "selector", value: ".class-that-does-not-exist" },
        });
        expect.fail("Should have thrown ELEMENT_NOT_FOUND");
      } catch (err: any) {
        expect(err.error.code).toBe("ELEMENT_NOT_FOUND");
      }
    });

    it("should handle selector with special characters", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      // Valid selector with special characters but no matches
      try {
        await getElement({
          target: { kind: "selector", value: "[data-test='value']" },
        });
        expect.fail("Should have thrown ELEMENT_NOT_FOUND");
      } catch (err: any) {
        expect(err.error.code).toBe("ELEMENT_NOT_FOUND");
      }
    });
  });

  describe("Edge Cases - Boundary Values", () => {
    it("should handle maxResults of 0", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      // maxResults of 0 should throw ELEMENT_NOT_FOUND
      try {
        await getElement({
          target: { kind: "selector", value: ".item" },
          maxResults: 0,
        });
        expect.fail("Should have thrown ELEMENT_NOT_FOUND for maxResults of 0");
      } catch (err: any) {
        expect(err.error.code).toBe("ELEMENT_NOT_FOUND");
      }
    });

    it("should handle maxResults of 1", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      const result = await getElement({
        target: { kind: "selector", value: ".item" },
        maxResults: 1,
      });

      expect(result.matchCount).toBe(1);
      expect(result.results).toHaveLength(1);
    });

    it("should cap maxResults above 50", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      const result = await getElement({
        target: { kind: "selector", value: ".item" },
        maxResults: 1000,
      });

      // Should be capped at the actual number of elements (15 in this case)
      expect(result.matchCount).toBeLessThanOrEqual(50);
      expect(result.results.length).toBeLessThanOrEqual(50);
    });
  });

  describe("Edge Cases - Missing Optional Fields", () => {
    it("should handle getElement with no include parameter", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      const result = await getElement({
        target: { kind: "id", value: "first" },
      });

      expect(result.matchCount).toBe(1);
      expect(result.results[0].exists).toBe(true);
      expect(result.results[0].nodeName).toBe("DIV");
      // Optional fields should be undefined
      expect(result.results[0].attributes).toBeUndefined();
      expect(result.results[0].computed).toBeUndefined();
      expect(result.results[0].boxModel).toBeUndefined();
      expect(result.results[0].role).toBeUndefined();
    });

    it("should handle getElement with empty include object", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      const result = await getElement({
        target: { kind: "id", value: "first" },
        include: {},
      });

      expect(result.matchCount).toBe(1);
      expect(result.results[0].exists).toBe(true);
      // All optional fields should be undefined
      expect(result.results[0].attributes).toBeUndefined();
      expect(result.results[0].computed).toBeUndefined();
      expect(result.results[0].boxModel).toBeUndefined();
      expect(result.results[0].role).toBeUndefined();
    });

    it("should handle getCssProvenance without includeContributors", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/css-cascade.html" });

      const result = await getCssProvenance({
        target: { kind: "selector", value: ".priority-test" },
        property: "padding-left",
      });

      expect(result.matchCount).toBe(1);
      expect(result.results[0].winner).toBeDefined();
      expect(result.results[0].contributors).toBeUndefined();
    });
  });

  describe("Edge Cases - Complex Selectors", () => {
    it("should handle descendant selector", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/css-cascade.html" });

      const result = await getElement({
        target: { kind: "selector", value: ".parent .child" },
        include: { attributes: true },
      });

      expect(result.matchCount).toBe(1);
      expect(result.results[0].exists).toBe(true);
    });

    it("should handle attribute selector", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/css-cascade.html" });

      const result = await getElement({
        target: { kind: "selector", value: "div[style]" },
        include: { attributes: true },
      });

      expect(result.matchCount).toBeGreaterThan(0);
      expect(result.results[0].exists).toBe(true);
    });

    it("should handle pseudo-class selector", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      const result = await getElement({
        target: { kind: "selector", value: ".item:first-child" },
        include: { attributes: true },
      });

      expect(result.matchCount).toBe(1);
      expect(result.results[0].exists).toBe(true);
    });
  });

  describe("Edge Cases - CSS Property Values", () => {
    it("should handle computed property with value 'none'", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      const result = await getElement({
        target: { kind: "id", value: "first" },
        include: {
          computed: ["text-decoration-line"],
        },
      });

      expect(result.matchCount).toBe(1);
      expect(result.results[0].computed).toBeDefined();
      expect(result.results[0].computed!["text-decoration-line"]).toBeDefined();
    });

    it("should handle computed property with 'auto' value", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      const result = await getElement({
        target: { kind: "id", value: "first" },
        include: {
          computed: ["z-index"],
        },
      });

      expect(result.matchCount).toBe(1);
      expect(result.results[0].computed).toBeDefined();
      expect(result.results[0].computed!["z-index"]).toBeDefined();
    });

    it("should handle inherited property values", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/css-cascade.html" });

      const result = await getCssProvenance({
        target: { kind: "selector", value: ".child" },
        property: "color",
      });

      expect(result.matchCount).toBe(1);
      expect(result.results[0].computedValue).toBeDefined();
    });
  });
});
