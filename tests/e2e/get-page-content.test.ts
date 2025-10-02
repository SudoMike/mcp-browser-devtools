import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { resolve } from "path";
import { loadConfig } from "../../src/config.js";
import { sessionStart } from "../../src/tools/session-start.js";
import { sessionStop } from "../../src/tools/session-stop.js";
import { navigate } from "../../src/tools/navigate.js";
import { getPageContent } from "../../src/tools/get-page-content.js";
import { TestServer } from "./fixtures/server.js";

describe("Get Page Content", () => {
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

  describe("Default behavior", () => {
    it("should return full HTML content with no parameters", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      const result = await getPageContent({});

      expect(result.html).toBeDefined();
      expect(result.fullLength).toBeGreaterThan(0);
      expect(result.html.length).toBe(result.fullLength);
      expect(result.html).toContain("<!DOCTYPE html>");
      expect(result.html).toContain("</html>");
    });

    it("should return full HTML when start is 0 and length is -1", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      const result = await getPageContent({ start: 0, length: -1 });

      expect(result.html).toBeDefined();
      expect(result.fullLength).toBeGreaterThan(0);
      expect(result.html.length).toBe(result.fullLength);
    });
  });

  describe("Slicing with start parameter", () => {
    it("should return content from start position to end", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      const fullResult = await getPageContent({});
      const slicedResult = await getPageContent({ start: 100 });

      expect(slicedResult.fullLength).toBe(fullResult.fullLength);
      expect(slicedResult.html.length).toBe(fullResult.fullLength - 100);
      expect(slicedResult.html).toBe(fullResult.html.slice(100));
    });

    it("should handle start at middle of document", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      const fullResult = await getPageContent({});
      const middleStart = Math.floor(fullResult.fullLength / 2);
      const result = await getPageContent({ start: middleStart });

      expect(result.fullLength).toBe(fullResult.fullLength);
      expect(result.html.length).toBe(fullResult.fullLength - middleStart);
      expect(result.html).toBe(fullResult.html.slice(middleStart));
    });

    it("should return empty string when start is at the end", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      const fullResult = await getPageContent({});
      const result = await getPageContent({ start: fullResult.fullLength });

      expect(result.fullLength).toBe(fullResult.fullLength);
      expect(result.html).toBe("");
    });

    it("should return empty string when start is beyond the end", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      const fullResult = await getPageContent({});
      const result = await getPageContent({
        start: fullResult.fullLength + 1000,
      });

      expect(result.fullLength).toBe(fullResult.fullLength);
      expect(result.html).toBe("");
    });
  });

  describe("Slicing with start and length parameters", () => {
    it("should return exact slice when start and length are specified", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      const fullResult = await getPageContent({});
      const result = await getPageContent({ start: 10, length: 50 });

      expect(result.fullLength).toBe(fullResult.fullLength);
      expect(result.html.length).toBe(50);
      expect(result.html).toBe(fullResult.html.slice(10, 60));
    });

    it("should handle length that extends beyond end of content", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      const fullResult = await getPageContent({});
      const result = await getPageContent({
        start: fullResult.fullLength - 100,
        length: 200,
      });

      expect(result.fullLength).toBe(fullResult.fullLength);
      expect(result.html.length).toBe(100);
      expect(result.html).toBe(
        fullResult.html.slice(fullResult.fullLength - 100),
      );
    });

    it("should handle length of 0", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      const fullResult = await getPageContent({});
      const result = await getPageContent({ start: 100, length: 0 });

      expect(result.fullLength).toBe(fullResult.fullLength);
      expect(result.html).toBe("");
    });

    it("should get first 100 characters", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      const result = await getPageContent({ start: 0, length: 100 });

      expect(result.html.length).toBe(100);
      expect(result.fullLength).toBeGreaterThan(100);
    });

    it("should get middle chunk of HTML", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      const fullResult = await getPageContent({});
      const result = await getPageContent({ start: 500, length: 200 });

      expect(result.html.length).toBe(200);
      expect(result.html).toBe(fullResult.html.slice(500, 700));
      expect(result.fullLength).toBe(fullResult.fullLength);
    });
  });

  describe("Length parameter with -1", () => {
    it("should return remainder when length is -1", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      const fullResult = await getPageContent({});
      const result = await getPageContent({ start: 100, length: -1 });

      expect(result.fullLength).toBe(fullResult.fullLength);
      expect(result.html.length).toBe(fullResult.fullLength - 100);
      expect(result.html).toBe(fullResult.html.slice(100));
    });

    it("should behave same as omitting length when length is -1", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      const result1 = await getPageContent({ start: 200 });
      const result2 = await getPageContent({ start: 200, length: -1 });

      expect(result1).toEqual(result2);
    });
  });

  describe("Content validation", () => {
    it("should return valid HTML structure", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/css-cascade.html" });

      const result = await getPageContent({});

      expect(result.html).toContain("<!DOCTYPE html>");
      expect(result.html).toContain("<html");
      expect(result.html).toContain("</html>");
      expect(result.html).toContain("<head>");
      expect(result.html).toContain("<body>");
    });

    it("should include style tags in HTML content", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/css-cascade.html" });

      const result = await getPageContent({});

      expect(result.html).toContain("<style");
      expect(result.html).toContain("</style>");
    });

    it("should include all elements from page", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      const result = await getPageContent({});

      expect(result.html).toContain('id="first"');
      expect(result.html).toContain('id="second"');
      expect(result.html).toContain('id="third"');
      expect(result.html).toContain('class="item"');
    });
  });

  describe("Edge cases", () => {
    it("should handle very small pages", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/css-cascade.html" });

      const result = await getPageContent({});

      expect(result.html).toBeDefined();
      expect(result.fullLength).toBeGreaterThan(0);
      expect(result.html.length).toBe(result.fullLength);
    });

    it("should handle requesting more content than available", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      const fullResult = await getPageContent({});
      const result = await getPageContent({
        start: 0,
        length: fullResult.fullLength * 2,
      });

      expect(result.html).toBe(fullResult.html);
      expect(result.fullLength).toBe(fullResult.fullLength);
    });

    it("should consistently return same fullLength", async () => {
      await sessionStart({}, loadedConfig);
      await navigate({ url: "/multiple-elements.html" });

      const result1 = await getPageContent({});
      const result2 = await getPageContent({ start: 100, length: 50 });
      const result3 = await getPageContent({ start: 500 });

      expect(result1.fullLength).toBe(result2.fullLength);
      expect(result2.fullLength).toBe(result3.fullLength);
    });
  });

  describe("Multiple pages", () => {
    it("should return different content for different pages", async () => {
      await sessionStart({}, loadedConfig);

      await navigate({ url: "/multiple-elements.html" });
      const result1 = await getPageContent({});

      await navigate({ url: "/css-cascade.html" });
      const result2 = await getPageContent({});

      expect(result1.html).not.toBe(result2.html);
      expect(result1.fullLength).not.toBe(result2.fullLength);
    });

    it("should reflect page changes after navigation", async () => {
      await sessionStart({}, loadedConfig);

      await navigate({ url: "/multiple-elements.html" });
      const result1 = await getPageContent({ length: 100 });

      await navigate({ url: "/css-cascade.html" });
      const result2 = await getPageContent({ length: 100 });

      expect(result1.fullLength).not.toBe(result2.fullLength);
    });
  });
});
