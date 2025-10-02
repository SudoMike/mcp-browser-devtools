import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { resolve } from "path";
import { loadConfig } from "../../src/config.js";
import { sessionStart } from "../../src/tools/session-start.js";
import { sessionStop } from "../../src/tools/session-stop.js";
import { getElement } from "../../src/tools/get-element.js";
import { TestServer } from "./fixtures/server.js";

describe("Device Emulation", () => {
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

  describe("iPhone 13 Emulation", () => {
    it("should emulate iPhone 13 viewport dimensions", async () => {
      await sessionStart({ scenario: "iphone" }, loadedConfig);

      // Get viewport width
      const widthResult = await getElement({
        target: { kind: "id", value: "viewport-width" },
        include: { attributes: true },
      });

      expect(widthResult.matchCount).toBe(1);
      expect(widthResult.results[0].attributes?.["data-value"]).toBe("390");

      // Get viewport height (innerHeight may be less than device height due to browser UI)
      const heightResult = await getElement({
        target: { kind: "id", value: "viewport-height" },
        include: { attributes: true },
      });

      expect(heightResult.matchCount).toBe(1);
      const height = Number(heightResult.results[0].attributes?.["data-value"]);
      // iPhone 13 viewport should be around 664-844 depending on browser chrome
      expect(height).toBeGreaterThan(600);
      expect(height).toBeLessThan(900);
    });

    it("should emulate iPhone 13 user agent", async () => {
      await sessionStart({ scenario: "iphone" }, loadedConfig);

      const result = await getElement({
        target: { kind: "id", value: "user-agent" },
        include: { attributes: true },
      });

      expect(result.matchCount).toBe(1);
      const userAgent = result.results[0].attributes?.["data-value"];
      expect(userAgent).toBeDefined();
      expect(userAgent).toContain("iPhone");
      expect(userAgent).toContain("Mobile");
    });
  });

  describe("iPad Pro 11 Emulation", () => {
    it("should emulate iPad Pro 11 viewport dimensions", async () => {
      await sessionStart({ scenario: "ipad" }, loadedConfig);

      // Get viewport width
      const widthResult = await getElement({
        target: { kind: "id", value: "viewport-width" },
        include: { attributes: true },
      });

      expect(widthResult.matchCount).toBe(1);
      expect(widthResult.results[0].attributes?.["data-value"]).toBe("834");

      // Get viewport height
      const heightResult = await getElement({
        target: { kind: "id", value: "viewport-height" },
        include: { attributes: true },
      });

      expect(heightResult.matchCount).toBe(1);
      expect(heightResult.results[0].attributes?.["data-value"]).toBe("1194");
    });

    it("should emulate iPad Pro 11 user agent", async () => {
      await sessionStart({ scenario: "ipad" }, loadedConfig);

      const result = await getElement({
        target: { kind: "id", value: "user-agent" },
        include: { attributes: true },
      });

      expect(result.matchCount).toBe(1);
      const userAgent = result.results[0].attributes?.["data-value"];
      expect(userAgent).toBeDefined();
      expect(userAgent).toContain("iPad");
    });
  });

  describe("Pixel 7 Emulation", () => {
    it("should emulate Pixel 7 viewport dimensions", async () => {
      await sessionStart({ scenario: "pixel" }, loadedConfig);

      // Get viewport width
      const widthResult = await getElement({
        target: { kind: "id", value: "viewport-width" },
        include: { attributes: true },
      });

      expect(widthResult.matchCount).toBe(1);
      expect(widthResult.results[0].attributes?.["data-value"]).toBe("412");

      // Get viewport height (innerHeight may be less than device height due to browser UI)
      const heightResult = await getElement({
        target: { kind: "id", value: "viewport-height" },
        include: { attributes: true },
      });

      expect(heightResult.matchCount).toBe(1);
      const height = Number(heightResult.results[0].attributes?.["data-value"]);
      // Pixel 7 viewport should be around 800-915 depending on browser chrome
      expect(height).toBeGreaterThan(800);
      expect(height).toBeLessThan(920);
    });

    it("should emulate Pixel 7 user agent", async () => {
      await sessionStart({ scenario: "pixel" }, loadedConfig);

      const result = await getElement({
        target: { kind: "id", value: "user-agent" },
        include: { attributes: true },
      });

      expect(result.matchCount).toBe(1);
      const userAgent = result.results[0].attributes?.["data-value"];
      expect(userAgent).toBeDefined();
      expect(userAgent).toContain("Linux");
      expect(userAgent).toContain("Android");
    });
  });

  describe("Device Emulation Error Handling", () => {
    it("should throw error for unknown device name", async () => {
      // Create a temporary config with invalid device
      const invalidConfig = {
        ...loadedConfig,
        hooks: {
          ...loadedConfig.hooks,
          scenarios: {
            invalid: {
              use: "deviceTest",
              description: "Invalid device",
              device: "NonExistentDevice123",
            },
          },
        },
      };

      try {
        await sessionStart({ scenario: "invalid" }, invalidConfig);
        expect.fail("Should have thrown error for unknown device");
      } catch (err: any) {
        // Error thrown during Playwright launch, not a DevTools error
        const errorMessage = err?.message || JSON.stringify(err);
        expect(errorMessage).toContain("Unknown device");
        expect(errorMessage).toContain("NonExistentDevice123");
      }
    });
  });

  describe("Device Config Validation", () => {
    it("should load device scenarios from config", () => {
      const scenarios = loadedConfig.hooks?.scenarios;
      expect(scenarios).toBeDefined();

      // Verify iPhone scenario
      expect(scenarios?.iphone).toBeDefined();
      expect(scenarios?.iphone.device).toBe("iPhone 13");

      // Verify iPad scenario
      expect(scenarios?.ipad).toBeDefined();
      expect(scenarios?.ipad.device).toBe("iPad Pro 11");

      // Verify Pixel scenario
      expect(scenarios?.pixel).toBeDefined();
      expect(scenarios?.pixel.device).toBe("Pixel 7");
    });

    it("should work with scenarios that have no device", async () => {
      // Default scenario has no device parameter
      await sessionStart({ scenario: "default" }, loadedConfig);

      // Should work fine without device emulation
      expect(true).toBe(true);
    });
  });
});
