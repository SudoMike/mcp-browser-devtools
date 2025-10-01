import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { resolve } from "path";
import { loadConfig } from "../../src/config.js";
import { sessionStart } from "../../src/tools/session-start.js";
import { sessionStop } from "../../src/tools/session-stop.js";
import { navigate } from "../../src/tools/navigate.js";
import { getElement } from "../../src/tools/get-element.js";
import { TestServer } from "./fixtures/server.js";

describe("CSS Computed Styles", () => {
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

  describe("Shorthand vs Longhand Properties", () => {
    it("should return computed values for longhand margin properties", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/shorthand-test.html" });

      const result = await getElement({
        target: { kind: "selector", value: ".margin-box" },
        include: {
          computed: ["ALL_DEFAULTS"],
        },
      });

      expect(result.matchCount).toBe(1);
      expect(result.results[0].computed).toBeDefined();

      const computed = result.results[0].computed!;
      expect(computed["margin-top"]).toBe("10px");
      expect(computed["margin-right"]).toBe("15px");
      expect(computed["margin-bottom"]).toBe("20px");
      expect(computed["margin-left"]).toBe("25px");
    });

    it("should return computed values for longhand padding properties", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/shorthand-test.html" });

      const result = await getElement({
        target: { kind: "selector", value: ".margin-box" },
        include: {
          computed: ["ALL_DEFAULTS"],
        },
      });

      expect(result.matchCount).toBe(1);
      const computed = result.results[0].computed!;

      expect(computed["padding-top"]).toBe("5px");
      expect(computed["padding-right"]).toBe("10px");
      expect(computed["padding-bottom"]).toBe("15px");
      expect(computed["padding-left"]).toBe("20px");
    });

    it("should return computed values for longhand border properties", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/shorthand-test.html" });

      const result = await getElement({
        target: { kind: "selector", value: ".border-box" },
        include: {
          computed: ["ALL_DEFAULTS", "border-top-style", "border-top-color"],
        },
      });

      expect(result.matchCount).toBe(1);
      const computed = result.results[0].computed!;

      // Border width is in defaults, style and color requested explicitly
      expect(computed["border-top-width"]).toBe("3px");
      expect(computed["border-right-width"]).toBe("3px");
      expect(computed["border-bottom-width"]).toBe("3px");
      expect(computed["border-left-width"]).toBe("3px");

      // Border style and color explicitly requested
      expect(computed["border-top-style"]).toBe("solid");
      expect(computed["border-top-color"]).toMatch(/rgb\(255,\s*0,\s*0\)/);
    });

    it("should return computed values for longhand font properties", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/shorthand-test.html" });

      const result = await getElement({
        target: { kind: "selector", value: ".font-box" },
        include: {
          computed: ["ALL_DEFAULTS", "font-style"],
        },
      });

      expect(result.matchCount).toBe(1);
      const computed = result.results[0].computed!;

      // DEFAULT_COMPUTED_PROPERTIES includes these font properties
      expect(computed["font-size"]).toBe("18px");
      expect(computed["font-weight"]).toBe("700");
      expect(computed["line-height"]).toBe("24px");
      expect(computed["font-family"]).toContain("Times New Roman");

      // font-style explicitly requested
      expect(computed["font-style"]).toBe("italic");
    });

    it("should return computed values for longhand flex properties", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/shorthand-test.html" });

      const result = await getElement({
        target: { kind: "selector", value: ".flex-box" },
        include: {
          computed: ["flex-grow", "flex-shrink", "flex-basis"],
        },
      });

      expect(result.matchCount).toBe(1);
      const computed = result.results[0].computed!;

      expect(computed["flex-grow"]).toBe("1");
      expect(computed["flex-shrink"]).toBe("1");
      expect(computed["flex-basis"]).toBe("auto");
    });

    it("should return computed values for longhand background properties", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/shorthand-test.html" });

      const result = await getElement({
        target: { kind: "selector", value: ".background-box" },
        include: {
          computed: ["ALL_DEFAULTS", "background-repeat", "background-position"],
        },
      });

      expect(result.matchCount).toBe(1);
      const computed = result.results[0].computed!;

      // background-color is in defaults
      expect(computed["background-color"]).toMatch(/rgb\(200,\s*200,\s*200\)/);
      // background-repeat is explicitly requested
      expect(computed["background-repeat"]).toBe("repeat");
      // Note: background-position is a shorthand, so we don't test it here
    });
  });

  describe("CSS Specificity and Cascade", () => {
    it("should return computed color from ID selector (higher specificity)", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/css-cascade.html" });

      const result = await getElement({
        target: { kind: "id", value: "special-box" },
        include: {
          computed: ["ALL_DEFAULTS", "font-style"],
        },
      });

      expect(result.matchCount).toBe(1);
      const computed = result.results[0].computed!;

      // ID selector should win over class selector
      expect(computed["color"]).toMatch(/rgb\(255,\s*0,\s*0\)/); // red
      expect(computed["font-size"]).toBe("24px");
    });

    it("should return computed values for later rule (cascade order)", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/css-cascade.html" });

      const result = await getElement({
        target: { kind: "selector", value: ".priority-test" },
        include: {
          computed: ["ALL_DEFAULTS", "font-style"],
        },
      });

      expect(result.matchCount).toBe(1);
      const computed = result.results[0].computed!;

      // Later rule should win
      expect(computed["padding-left"]).toBe("20px");
    });

    it("should respect !important declarations", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/css-cascade.html" });

      const result = await getElement({
        target: { kind: "selector", value: ".important-test" },
        include: {
          computed: ["ALL_DEFAULTS", "font-style"],
        },
      });

      expect(result.matchCount).toBe(1);
      const computed = result.results[0].computed!;

      // !important should win for background-color
      expect(computed["background-color"]).toMatch(/rgb\(255,\s*255,\s*0\)/); // yellow

      // Without !important, later rule should win for padding-top
      expect(computed["padding-top"]).toBe("15px");
    });
  });

  describe("Inline Styles", () => {
    it("should return computed values from inline styles (highest priority)", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/css-cascade.html" });

      const result = await getElement({
        target: { kind: "selector", value: 'div[style*="color: green"]' },
        include: {
          computed: ["ALL_DEFAULTS", "font-style"],
        },
      });

      expect(result.matchCount).toBe(1);
      const computed = result.results[0].computed!;

      // Inline style should override stylesheet
      expect(computed["color"]).toMatch(/rgb\(0,\s*128,\s*0\)/); // green
      expect(computed["font-weight"]).toBe("700"); // bold
    });
  });

  describe("Inheritance", () => {
    it("should compute inherited properties correctly", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/css-cascade.html" });

      const result = await getElement({
        target: { kind: "selector", value: ".child" },
        include: {
          computed: ["ALL_DEFAULTS", "font-style"],
        },
      });

      expect(result.matchCount).toBe(1);
      const computed = result.results[0].computed!;

      // These properties should be inherited from .parent
      expect(computed["color"]).toMatch(/rgb\(128,\s*0,\s*128\)/); // purple
      expect(computed["font-family"]).toContain("Arial");
      // line-height 1.5 is computed to pixels (1.5 * font-size)
      expect(computed["line-height"]).toBe("24px"); // 16px * 1.5
    });
  });
});
