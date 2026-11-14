"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const matcher_js_1 = require("../src/matcher.js");
(0, vitest_1.describe)("Matcher Edge Cases", () => {
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
    (0, vitest_1.it)("Edge Case 1: Floating point epsilon safety (0.004% diff should be EXACT)", () => {
        const candidate = {
            name: "Product Float Safe",
            manufacturer: "Precision Labs",
            composition: {
                A: 35.004,
                B: 44.996,
                C: 10.002,
                D: 9.998,
            },
        };
        const result = (0, matcher_js_1.matchProduct)(referenceProduct, candidate, defaultConfig);
        (0, vitest_1.expect)(result.category).toBe("EXACT_MATCH");
        (0, vitest_1.expect)(result.similarityScore).toBe(100.0);
    });
    (0, vitest_1.it)("Edge Case 2: Missing core ingredient (Candidate lacks D entirely)", () => {
        const candidate = {
            name: "Lacks Ingredient D",
            manufacturer: "Incomplete Formulations",
            composition: { A: 35, B: 45, C: 20 },
        };
        const result = (0, matcher_js_1.matchProduct)(referenceProduct, candidate, defaultConfig);
        (0, vitest_1.expect)(result.category).toBe("NO_MATCH");
        (0, vitest_1.expect)(result.explanation).toContain("Missing core ingredient: D (10%)");
    });
    (0, vitest_1.it)("Edge Case 3: Extra ingredient percentage exceeds cap (E is 2.5% vs 2.0% cap)", () => {
        const candidate = {
            name: "Excess Extra Ingredient",
            manufacturer: "BioBlend",
            composition: { A: 35, B: 45, C: 10, D: 7.5, E: 2.5 },
        };
        const result = (0, matcher_js_1.matchProduct)(referenceProduct, candidate, defaultConfig);
        (0, vitest_1.expect)(result.category).toBe("NO_MATCH");
        (0, vitest_1.expect)(result.explanation).toContain("Extra ingredient exceeding 2% limit: E (2.5%)");
    });
    (0, vitest_1.it)("Edge Case 4: Extra ingredient count exceeds limit (2 extra ingredients when cap is 1)", () => {
        const candidate = {
            name: "Too Many Extra Ingredients",
            manufacturer: "MultiBlend",
            composition: { A: 35, B: 45, C: 10, D: 8, E: 1, F: 1 },
        };
        const result = (0, matcher_js_1.matchProduct)(referenceProduct, candidate, defaultConfig);
        (0, vitest_1.expect)(result.category).toBe("NO_MATCH");
        (0, vitest_1.expect)(result.explanation).toContain("Contains 2 extra ingredients (allowed max: 1)");
    });
    (0, vitest_1.it)("Edge Case 5: Dynamic config sensitivity (Product Q fails if tolerance is reduced to 2.0pp)", () => {
        const candidate = {
            name: "Product Q",
            manufacturer: "Delta Bio",
            composition: { A: 32, B: 45, C: 13, D: 10 },
        };
        const tightConfig = {
            ...defaultConfig,
            tolerance_pp: 2.0,
        };
        const result = (0, matcher_js_1.matchProduct)(referenceProduct, candidate, tightConfig);
        (0, vitest_1.expect)(result.category).toBe("NO_MATCH");
        (0, vitest_1.expect)(result.explanation).toContain("Exceeds ±2pp tolerance");
    });
    (0, vitest_1.it)("Edge Case 6: Single-ingredient reference product", () => {
        const singleRef = {
            name: "Pure API A",
            manufacturer: "Us",
            composition: { A: 100 },
        };
        const exactCand = {
            name: "Pure A",
            manufacturer: "Competitor",
            composition: { A: 100 },
        };
        const closeCand = {
            name: "Almost Pure A",
            manufacturer: "Competitor 2",
            composition: { A: 98, Excipient: 2 },
        };
        (0, vitest_1.expect)((0, matcher_js_1.matchProduct)(singleRef, exactCand, defaultConfig).category).toBe("EXACT_MATCH");
        (0, vitest_1.expect)((0, matcher_js_1.matchProduct)(singleRef, closeCand, defaultConfig).category).toBe("CLOSE_MATCH");
    });
    (0, vitest_1.it)("Edge Case 7: Empty catalog handles gracefully", () => {
        const results = (0, matcher_js_1.matchCatalog)(referenceProduct, [], defaultConfig);
        (0, vitest_1.expect)(results).toEqual([]);
    });
});
