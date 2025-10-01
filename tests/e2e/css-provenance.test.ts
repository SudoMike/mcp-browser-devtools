import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { resolve } from "path";
import { loadConfig } from "../../src/config.js";
import { sessionStart } from "../../src/tools/session-start.js";
import { sessionStop } from "../../src/tools/session-stop.js";
import { navigate } from "../../src/tools/navigate.js";
import { getCssProvenance } from "../../src/tools/get-css-provenance.js";
import { TestServer } from "./fixtures/server.js";

describe("CSS Provenance and Cascade", () => {
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

  describe("Shorthand Property Rejection", () => {
    it("should reject shorthand property 'margin'", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/shorthand-test.html" });

      try {
        await getCssProvenance({
          target: { kind: "selector", value: ".margin-box" },
          property: "margin",
        });
        expect.fail("Should have thrown an error for shorthand property");
      } catch (err: any) {
        expect(err.error.message).toMatch(/shorthand/i);
      }
    });

    it("should reject shorthand property 'border'", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/shorthand-test.html" });

      try {
        await getCssProvenance({
          target: { kind: "selector", value: ".border-box" },
          property: "border",
        });
        expect.fail("Should have thrown an error for shorthand property");
      } catch (err: any) {
        expect(err.error.message).toMatch(/shorthand/i);
      }
    });

    it("should reject shorthand property 'padding'", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/shorthand-test.html" });

      try {
        await getCssProvenance({
          target: { kind: "selector", value: ".margin-box" },
          property: "padding",
        });
        expect.fail("Should have thrown an error for shorthand property");
      } catch (err: any) {
        expect(err.error.message).toMatch(/shorthand/i);
      }
    });

    it("should reject shorthand property 'background'", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/shorthand-test.html" });

      try {
        await getCssProvenance({
          target: { kind: "selector", value: ".background-box" },
          property: "background",
        });
        expect.fail("Should have thrown an error for shorthand property");
      } catch (err: any) {
        expect(err.error.message).toMatch(/shorthand/i);
      }
    });

    it("should reject shorthand property 'font'", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/shorthand-test.html" });

      try {
        await getCssProvenance({
          target: { kind: "selector", value: ".font-box" },
          property: "font",
        });
        expect.fail("Should have thrown an error for shorthand property");
      } catch (err: any) {
        expect(err.error.message).toMatch(/shorthand/i);
      }
    });

    it("should reject shorthand property 'flex'", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/shorthand-test.html" });

      try {
        await getCssProvenance({
          target: { kind: "selector", value: ".flex-box" },
          property: "flex",
        });
        expect.fail("Should have thrown an error for shorthand property");
      } catch (err: any) {
        expect(err.error.message).toMatch(/shorthand/i);
      }
    });

    it("should reject shorthand property 'border-top'", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/shorthand-test.html" });

      try {
        await getCssProvenance({
          target: { kind: "selector", value: ".border-box" },
          property: "border-top",
        });
        expect.fail("Should have thrown an error for shorthand property");
      } catch (err: any) {
        expect(err.error.message).toMatch(/shorthand/i);
      }
    });
  });

  describe("Longhand Property Provenance", () => {
    it("should return provenance for longhand property 'margin-top'", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/shorthand-test.html" });

      const result = await getCssProvenance({
        target: { kind: "selector", value: ".margin-box" },
        property: "margin-top",
      });

      expect(result.matchCount).toBe(1);
      expect(result.results[0].property).toBe("margin-top");
      expect(result.results[0].computedValue).toBe("10px");
      expect(result.results[0].winner).toBeDefined();
      expect(result.results[0].winner?.source).toBe("stylesheet");
      expect(result.results[0].winner?.value).toBe("10px");
    });

    it("should return provenance for longhand property 'border-left-width'", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/css-cascade.html" });

      const result = await getCssProvenance({
        target: { kind: "selector", value: ".border-test" },
        property: "border-left-width",
      });

      expect(result.matchCount).toBe(1);
      expect(result.results[0].property).toBe("border-left-width");
      expect(result.results[0].computedValue).toBe("4px");
      expect(result.results[0].winner).toBeDefined();
      expect(result.results[0].winner?.value).toBe("4px");
    });

    it("should return provenance for longhand property 'padding-left'", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/shorthand-test.html" });

      const result = await getCssProvenance({
        target: { kind: "selector", value: ".margin-box" },
        property: "padding-left",
      });

      expect(result.matchCount).toBe(1);
      expect(result.results[0].property).toBe("padding-left");
      expect(result.results[0].computedValue).toBe("20px");
      expect(result.results[0].winner?.value).toBe("20px");
    });
  });

  describe("Cascade Resolution", () => {
    it("should identify winning declaration from multiple rules", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/css-cascade.html" });

      const result = await getCssProvenance({
        target: { kind: "selector", value: ".priority-test" },
        property: "padding-left",
        includeContributors: true,
      });

      expect(result.matchCount).toBe(1);
      expect(result.results[0].computedValue).toBe("20px");
      expect(result.results[0].winner?.value).toBe("20px");

      // Should have contributors (the overridden rule)
      expect(result.results[0].contributors).toBeDefined();
      expect(result.results[0].contributors!.length).toBeGreaterThan(0);
    });

    it("should respect !important in cascade", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/css-cascade.html" });

      const result = await getCssProvenance({
        target: { kind: "selector", value: ".important-test" },
        property: "background-color",
        includeContributors: true,
      });

      expect(result.matchCount).toBe(1);
      expect(result.results[0].winner).toBeDefined();
      expect(result.results[0].winner?.important).toBe(true);
      expect(result.results[0].winner?.value).toMatch(/yellow/i);

      // Should have contributors (the non-important rule)
      expect(result.results[0].contributors).toBeDefined();
      expect(result.results[0].contributors!.length).toBeGreaterThan(0);
    });

    it("should handle ID selector specificity", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/css-cascade.html" });

      const result = await getCssProvenance({
        target: { kind: "id", value: "special-box" },
        property: "color",
        includeContributors: true,
      });

      expect(result.matchCount).toBe(1);
      expect(result.results[0].winner).toBeDefined();
      expect(result.results[0].winner?.selector).toContain("special-box");

      // Computed value should be from ID selector (red)
      expect(result.results[0].computedValue).toMatch(/rgb\(255,\s*0,\s*0\)/);
    });
  });

  describe("Inline Style Provenance", () => {
    it("should identify inline styles as source", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/css-cascade.html" });

      const result = await getCssProvenance({
        target: { kind: "selector", value: 'div[style*="color: green"]' },
        property: "color",
      });

      expect(result.matchCount).toBe(1);
      expect(result.results[0].winner).toBeDefined();
      expect(result.results[0].winner?.source).toBe("inline");
      expect(result.results[0].computedValue).toMatch(/rgb\(0,\s*128,\s*0\)/); // green
    });

    it("should identify inline style for font-weight", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/css-cascade.html" });

      const result = await getCssProvenance({
        target: { kind: "selector", value: 'div[style*="font-weight: bold"]' },
        property: "font-weight",
      });

      expect(result.matchCount).toBe(1);
      expect(result.results[0].winner).toBeDefined();
      expect(result.results[0].winner?.source).toBe("inline");
      expect(result.results[0].computedValue).toBe("700");
    });
  });

  describe("Source Location Information", () => {
    it("should include selector information for stylesheet rules", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/css-cascade.html" });

      const result = await getCssProvenance({
        target: { kind: "selector", value: ".border-test" },
        property: "border-left-width",
      });

      expect(result.matchCount).toBe(1);
      expect(result.results[0].winner).toBeDefined();
      expect(result.results[0].winner?.source).toBe("stylesheet");
      expect(result.results[0].winner?.selector).toContain("border-test");
    });

    it("should include line/column information when available", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/css-cascade.html" });

      const result = await getCssProvenance({
        target: { kind: "selector", value: ".box" },
        property: "color",
      });

      expect(result.matchCount).toBe(1);
      expect(result.results[0].winner).toBeDefined();

      // Line/column information should be present for stylesheet rules
      if (result.results[0].winner?.source === "stylesheet") {
        expect(result.results[0].winner.line).toBeDefined();
        expect(result.results[0].winner.column).toBeDefined();
        expect(typeof result.results[0].winner.line).toBe("number");
        expect(typeof result.results[0].winner.column).toBe("number");
      }
    });
  });

  describe("Contributors (Non-winning Declarations)", () => {
    it("should return contributors when requested", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/css-cascade.html" });

      const result = await getCssProvenance({
        target: { kind: "selector", value: ".priority-test" },
        property: "padding-left",
        includeContributors: true,
      });

      expect(result.matchCount).toBe(1);
      expect(result.results[0].contributors).toBeDefined();
      expect(Array.isArray(result.results[0].contributors)).toBe(true);
    });

    it("should not return contributors when not requested", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/css-cascade.html" });

      const result = await getCssProvenance({
        target: { kind: "selector", value: ".priority-test" },
        property: "padding-left",
        includeContributors: false,
      });

      expect(result.matchCount).toBe(1);
      expect(result.results[0].contributors).toBeUndefined();
    });
  });
});
