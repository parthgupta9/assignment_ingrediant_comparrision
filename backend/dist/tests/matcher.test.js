"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const matcher_js_1 = require("../src/matcher.js");
(0, vitest_1.describe)("Ingredient Matcher Engine", () => {
    const referenceProduct = {
        name: "Product X",
        manufacturer: "Us",
        composition: { A: 35, B: 45, C: 10, D: 10 },
    };
    const defaultConfig = {
        tolerance_pp: 3.0,
        max_extra_ingredients: 1,
        max_extra_percentage: 2.0,
        epsilon: 0.01,
    };
    (0, vitest_1.describe)("Sample Dataset Matching", () => {
        (0, vitest_1.it)("should classify Product Y as an EXACT MATCH", () => {
            const candidate = {
                name: "Product Y",
                manufacturer: "Acme Pharma",
                composition: { A: 35, B: 45, C: 10, D: 10 },
            };
            const result = (0, matcher_js_1.matchProduct)(referenceProduct, candidate, defaultConfig);
            (0, vitest_1.expect)(result.category).toBe("EXACT_MATCH");
            (0, vitest_1.expect)(result.similarityScore).toBe(100.0);
            (0, vitest_1.expect)(result.explanation).toContain("Exact match");
            (0, vitest_1.expect)(result.metrics.sharedCount).toBe(4);
            (0, vitest_1.expect)(result.metrics.extraCount).toBe(0);
            (0, vitest_1.expect)(result.metrics.missingCount).toBe(0);
        });
        (0, vitest_1.it)("should classify Product Z as an EXACT MATCH", () => {
            const candidate = {
                name: "Product Z",
                manufacturer: "Beacon Labs",
                composition: { A: 35, B: 45, C: 10, D: 10 },
            };
            const result = (0, matcher_js_1.matchProduct)(referenceProduct, candidate, defaultConfig);
            (0, vitest_1.expect)(result.category).toBe("EXACT_MATCH");
            (0, vitest_1.expect)(result.similarityScore).toBe(100.0);
        });
        (0, vitest_1.it)("should classify Product P as a CLOSE MATCH (1 extra ingredient E at 2%, D off by 2pp)", () => {
            const candidate = {
                name: "Product P",
                manufacturer: "Crestline Formulations",
                composition: { A: 35, B: 45, C: 10, D: 8, E: 2 },
            };
            const result = (0, matcher_js_1.matchProduct)(referenceProduct, candidate, defaultConfig);
            (0, vitest_1.expect)(result.category).toBe("CLOSE_MATCH");
            (0, vitest_1.expect)(result.similarityScore).toBeGreaterThanOrEqual(95.0);
            (0, vitest_1.expect)(result.explanation).toContain("1 additional ingredient");
            (0, vitest_1.expect)(result.explanation).toContain("E, 2%");
            (0, vitest_1.expect)(result.explanation).toContain("D differs by 2pp");
        });
        (0, vitest_1.it)("should classify Product Q as a CLOSE MATCH within ±3pp tolerance", () => {
            const candidate = {
                name: "Product Q",
                manufacturer: "Delta Bio",
                composition: { A: 32, B: 45, C: 13, D: 10 },
            };
            const result = (0, matcher_js_1.matchProduct)(referenceProduct, candidate, defaultConfig);
            (0, vitest_1.expect)(result.category).toBe("CLOSE_MATCH");
            (0, vitest_1.expect)(result.explanation).toContain("A differs by 3pp");
            (0, vitest_1.expect)(result.explanation).toContain("C differs by 3pp");
        });
        (0, vitest_1.it)("should classify Product S as a CLOSE MATCH (D off by 1pp, 1 extra minor ingredient F: 1%)", () => {
            const candidate = {
                name: "Product S",
                manufacturer: "Fortis Chem",
                composition: { A: 35, B: 45, C: 10, D: 9, F: 1 },
            };
            const result = (0, matcher_js_1.matchProduct)(referenceProduct, candidate, defaultConfig);
            (0, vitest_1.expect)(result.category).toBe("CLOSE_MATCH");
            (0, vitest_1.expect)(result.metrics.extraCount).toBe(1);
            (0, vitest_1.expect)(result.explanation).toContain("F, 1%");
        });
        (0, vitest_1.it)("should classify Product R as NO MATCH (wildly different ratios: A 50%, B 30%)", () => {
            const candidate = {
                name: "Product R",
                manufacturer: "Everwell",
                composition: { A: 50, B: 30, C: 10, D: 10 },
            };
            const result = (0, matcher_js_1.matchProduct)(referenceProduct, candidate, defaultConfig);
            (0, vitest_1.expect)(result.category).toBe("NO_MATCH");
            (0, vitest_1.expect)(result.explanation).toContain("Exceeds ±3pp tolerance");
            (0, vitest_1.expect)(result.explanation).toContain("A differs by +15pp");
            (0, vitest_1.expect)(result.explanation).toContain("B differs by -15pp");
        });
        (0, vitest_1.it)("should classify Product T as NO MATCH (contains 20% unknown ingredient G)", () => {
            const candidate = {
                name: "Product T",
                manufacturer: "Granite Pharma",
                composition: { A: 20, B: 20, C: 20, D: 20, G: 20 },
            };
            const result = (0, matcher_js_1.matchProduct)(referenceProduct, candidate, defaultConfig);
            (0, vitest_1.expect)(result.category).toBe("NO_MATCH");
            (0, vitest_1.expect)(result.explanation).toContain("Extra ingredient exceeding 2% limit: G (20%)");
        });
    });
    (0, vitest_1.describe)("Catalog Ranking Order", () => {
        (0, vitest_1.it)("should rank exact matches first, then close matches, then no-matches sorted by similarity", () => {
            const catalog = [
                { name: "Product R", manufacturer: "Everwell", composition: { A: 50, B: 30, C: 10, D: 10 } },
                { name: "Product Y", manufacturer: "Acme", composition: { A: 35, B: 45, C: 10, D: 10 } },
                { name: "Product P", manufacturer: "Crestline", composition: { A: 35, B: 45, C: 10, D: 8, E: 2 } },
                { name: "Product Z", manufacturer: "Beacon", composition: { A: 35, B: 45, C: 10, D: 10 } },
            ];
            const ranked = (0, matcher_js_1.matchCatalog)(referenceProduct, catalog, defaultConfig);
            (0, vitest_1.expect)(ranked[0].category).toBe("EXACT_MATCH");
            (0, vitest_1.expect)(ranked[1].category).toBe("EXACT_MATCH");
            (0, vitest_1.expect)(ranked[2].category).toBe("CLOSE_MATCH");
            (0, vitest_1.expect)(ranked[3].category).toBe("NO_MATCH");
        });
    });
});
