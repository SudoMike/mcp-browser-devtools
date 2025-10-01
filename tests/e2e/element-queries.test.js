import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { resolve } from "path";
import { loadConfig } from "../../src/config.js";
import { sessionStart } from "../../src/tools/session-start.js";
import { sessionStop } from "../../src/tools/session-stop.js";
import { navigate } from "../../src/tools/navigate.js";
import { getElement } from "../../src/tools/get-element.js";
import { getCssProvenance } from "../../src/tools/get-css-provenance.js";
import { TestServer } from "./fixtures/server.js";
describe("Element Queries and Multiple Results", () => {
    const server = new TestServer();
    let loadedConfig;
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
        }
        catch {
            // Ignore if no session
        }
    });
    describe("Single Element Queries", () => {
        it("should return single element by ID", async () => {
            await sessionStart({}, loadedConfig);
            await navigate({ url: "/multiple-elements.html" });
            const result = await getElement({
                target: { kind: "id", value: "first" },
                include: ["attributes", "computed"],
            });
            expect(result.matchCount).toBe(1);
            expect(result.results).toHaveLength(1);
            expect(result.results[0].exists).toBe(true);
            expect(result.results[0].nodeName).toBe("DIV");
            expect(result.results[0].attributes?.id).toBe("first");
        });
        it("should return single element by selector", async () => {
            await sessionStart({}, loadedConfig);
            await navigate({ url: "/multiple-elements.html" });
            const result = await getElement({
                target: { kind: "selector", value: "#second" },
                include: ["attributes"],
            });
            expect(result.matchCount).toBe(1);
            expect(result.results).toHaveLength(1);
            expect(result.results[0].attributes?.id).toBe("second");
        });
    });
    describe("Multiple Element Queries", () => {
        it("should return all matching elements by default (up to 10)", async () => {
            await sessionStart({}, loadedConfig);
            await navigate({ url: "/multiple-elements.html" });
            const result = await getElement({
                target: { kind: "selector", value: ".item" },
                include: ["attributes"],
            });
            // Default maxResults is 10
            expect(result.matchCount).toBe(10);
            expect(result.results).toHaveLength(10);
            // Verify they all have the 'item' class
            for (const item of result.results) {
                expect(item.attributes?.class).toContain("item");
            }
        });
        it("should respect maxResults parameter (limit to 5)", async () => {
            await sessionStart({}, loadedConfig);
            await navigate({ url: "/multiple-elements.html" });
            const result = await getElement({
                target: { kind: "selector", value: ".item" },
                include: ["attributes"],
                maxResults: 5,
            });
            expect(result.matchCount).toBe(5);
            expect(result.results).toHaveLength(5);
        });
        it("should respect maxResults parameter (limit to 3)", async () => {
            await sessionStart({}, loadedConfig);
            await navigate({ url: "/multiple-elements.html" });
            const result = await getElement({
                target: { kind: "selector", value: ".item" },
                include: ["attributes"],
                maxResults: 3,
            });
            expect(result.matchCount).toBe(3);
            expect(result.results).toHaveLength(3);
        });
        it("should return correct count even when many elements match", async () => {
            await sessionStart({}, loadedConfig);
            await navigate({ url: "/multiple-elements.html" });
            const result = await getElement({
                target: { kind: "selector", value: ".item" },
                include: ["attributes"],
                maxResults: 15,
            });
            // There are 15 items in the HTML
            expect(result.matchCount).toBe(15);
            expect(result.results).toHaveLength(15);
        });
        it("should cap maxResults at 50", async () => {
            await sessionStart({}, loadedConfig);
            await navigate({ url: "/multiple-elements.html" });
            // Request more than 50
            const result = await getElement({
                target: { kind: "selector", value: ".item" },
                include: ["attributes"],
                maxResults: 100,
            });
            // Should be capped at 15 (total available)
            expect(result.matchCount).toBe(15);
            expect(result.results).toHaveLength(15);
        });
        it("should return subset selector matches", async () => {
            await sessionStart({}, loadedConfig);
            await navigate({ url: "/multiple-elements.html" });
            const result = await getElement({
                target: { kind: "selector", value: ".item.special" },
                include: ["attributes"],
            });
            // Only 2 items have both 'item' and 'special' classes
            expect(result.matchCount).toBe(2);
            expect(result.results).toHaveLength(2);
            for (const item of result.results) {
                expect(item.attributes?.class).toContain("special");
            }
        });
    });
    describe("Multiple Elements with Computed Styles", () => {
        it("should return computed styles for multiple elements", async () => {
            await sessionStart({}, loadedConfig);
            await navigate({ url: "/css-cascade.html" });
            const result = await getElement({
                target: { kind: "selector", value: ".multi" },
                include: ["computed"],
                maxResults: 5,
            });
            expect(result.matchCount).toBe(5);
            expect(result.results).toHaveLength(5);
            // All should have the same computed styles
            for (const item of result.results) {
                expect(item.computed).toBeDefined();
                expect(item.computed["margin-top"]).toBe("8px");
                expect(item.computed["padding-top"]).toBe("12px");
                expect(item.computed["border-top-width"]).toBe("2px");
            }
        });
        it("should return different computed colors for different IDs", async () => {
            await sessionStart({}, loadedConfig);
            await navigate({ url: "/multiple-elements.html" });
            const first = await getElement({
                target: { kind: "id", value: "first" },
                include: ["computed"],
            });
            const second = await getElement({
                target: { kind: "id", value: "second" },
                include: ["computed"],
            });
            const third = await getElement({
                target: { kind: "id", value: "third" },
                include: ["computed"],
            });
            // Each should have different colors
            expect(first.results[0].computed["color"]).toMatch(/rgb\(255,\s*0,\s*0\)/); // red
            expect(second.results[0].computed["color"]).toMatch(/rgb\(0,\s*0,\s*255\)/); // blue
            expect(third.results[0].computed["color"]).toMatch(/rgb\(0,\s*128,\s*0\)/); // green
        });
    });
    describe("Multiple Elements with CSS Provenance", () => {
        it("should return CSS provenance for multiple elements", async () => {
            await sessionStart({}, loadedConfig);
            await navigate({ url: "/css-cascade.html" });
            const result = await getCssProvenance({
                target: { kind: "selector", value: ".multi" },
                property: "margin-top",
                maxResults: 5,
            });
            expect(result.matchCount).toBe(5);
            expect(result.results).toHaveLength(5);
            // All should have the same provenance
            for (const item of result.results) {
                expect(item.property).toBe("margin-top");
                expect(item.computedValue).toBe("8px");
                expect(item.winner).toBeDefined();
                expect(item.winner?.value).toBe("8px");
            }
        });
        it("should return CSS provenance for all matching elements (default limit)", async () => {
            await sessionStart({}, loadedConfig);
            await navigate({ url: "/css-cascade.html" });
            const result = await getCssProvenance({
                target: { kind: "selector", value: ".multi" },
                property: "border-top-width",
            });
            // Default maxResults is 10, but there are only 5 .multi elements
            expect(result.matchCount).toBe(5);
            expect(result.results).toHaveLength(5);
            for (const item of result.results) {
                expect(item.computedValue).toBe("2px");
            }
        });
        it("should respect maxResults in getCssProvenance", async () => {
            await sessionStart({}, loadedConfig);
            await navigate({ url: "/css-cascade.html" });
            const result = await getCssProvenance({
                target: { kind: "selector", value: ".multi" },
                property: "padding-top",
                maxResults: 3,
            });
            expect(result.matchCount).toBe(3);
            expect(result.results).toHaveLength(3);
        });
    });
    describe("Selector Count Accuracy", () => {
        it("should return accurate matchCount when fewer elements exist than requested", async () => {
            await sessionStart({}, loadedConfig);
            await navigate({ url: "/multiple-elements.html" });
            const result = await getElement({
                target: { kind: "selector", value: ".special" },
                include: ["attributes"],
                maxResults: 10,
            });
            // Only 2 elements have .special class
            expect(result.matchCount).toBe(2);
            expect(result.results).toHaveLength(2);
        });
        it("should return matchCount of 1 for unique ID", async () => {
            await sessionStart({}, loadedConfig);
            await navigate({ url: "/multiple-elements.html" });
            const result = await getElement({
                target: { kind: "id", value: "first" },
                include: ["attributes"],
            });
            expect(result.matchCount).toBe(1);
            expect(result.results).toHaveLength(1);
        });
        it("should return matchCount matching requested maxResults when more elements exist", async () => {
            await sessionStart({}, loadedConfig);
            await navigate({ url: "/multiple-elements.html" });
            const result = await getElement({
                target: { kind: "selector", value: ".item" },
                include: ["attributes"],
                maxResults: 7,
            });
            // 15 items exist, but we only requested 7
            expect(result.matchCount).toBe(7);
            expect(result.results).toHaveLength(7);
        });
    });
    describe("Element Attributes and Properties", () => {
        it("should return all requested information types", async () => {
            await sessionStart({}, loadedConfig);
            await navigate({ url: "/multiple-elements.html" });
            const result = await getElement({
                target: { kind: "id", value: "first" },
                include: ["boxModel", "computed", "attributes", "role"],
            });
            expect(result.matchCount).toBe(1);
            const element = result.results[0];
            expect(element.exists).toBe(true);
            expect(element.nodeName).toBe("DIV");
            expect(element.attributes).toBeDefined();
            expect(element.boxModel).toBeDefined();
            expect(element.computed).toBeDefined();
            expect(element.role).toBeDefined();
        });
        it("should return only requested information types", async () => {
            await sessionStart({}, loadedConfig);
            await navigate({ url: "/multiple-elements.html" });
            const result = await getElement({
                target: { kind: "id", value: "first" },
                include: ["attributes"],
            });
            expect(result.matchCount).toBe(1);
            const element = result.results[0];
            expect(element.attributes).toBeDefined();
            expect(element.boxModel).toBeUndefined();
            expect(element.computed).toBeUndefined();
            expect(element.role).toBeUndefined();
        });
        it("should verify boxModel has correct structure", async () => {
            await sessionStart({}, loadedConfig);
            await navigate({ url: "/multiple-elements.html" });
            const result = await getElement({
                target: { kind: "id", value: "first" },
                include: ["boxModel"],
            });
            expect(result.matchCount).toBe(1);
            const boxModel = result.results[0].boxModel;
            expect(boxModel).toBeDefined();
            expect(typeof boxModel.x).toBe("number");
            expect(typeof boxModel.y).toBe("number");
            expect(typeof boxModel.width).toBe("number");
            expect(typeof boxModel.height).toBe("number");
            expect(boxModel.content).toBeDefined();
            expect(boxModel.padding).toBeDefined();
            expect(boxModel.border).toBeDefined();
            expect(boxModel.margin).toBeDefined();
        });
    });
});
//# sourceMappingURL=element-queries.test.js.map