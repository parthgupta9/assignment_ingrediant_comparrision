import { describe, it, expect } from "vitest";
import { matchProduct, matchCatalog } from "../src/matcher.js";
import { Product, MatchConfig } from "../src/types.js";

describe("Matcher Edge Cases", () => {
  const referenceProduct: Product = {
    name: "Product X",
    manufacturer: "Us",
    composition: { A: 35, B: 45, C: 10, D: 10 },
  };

  const defaultConfig: MatchConfig = {
    tolerance_pp: 3.0,
    max_extra_ingredients: 1,
    max_extra_percentage: 2.0,
    epsilon: 0.01,
  };

  it("Edge Case 1: Floating point epsilon safety (0.004% diff should be EXACT)", () => {
    const candidate: Product = {
      name: "Product Float Safe",
      manufacturer: "Precision Labs",
      composition: {
        A: 35.004,
        B: 44.996,
        C: 10.002,
        D: 9.998,
      },
    };

    const result = matchProduct(referenceProduct, candidate, defaultConfig);
    expect(result.category).toBe("EXACT_MATCH");
    expect(result.similarityScore).toBe(100.0);
  });

  it("Edge Case 2: Missing core ingredient (Candidate lacks D entirely)", () => {
    const candidate: Product = {
      name: "Lacks Ingredient D",
      manufacturer: "Incomplete Formulations",
      composition: { A: 35, B: 45, C: 20 },
    };

    const result = matchProduct(referenceProduct, candidate, defaultConfig);
    expect(result.category).toBe("NO_MATCH");
    expect(result.explanation).toContain("Missing core ingredient: D (10%)");
  });

  it("Edge Case 3: Extra ingredient percentage exceeds cap (E is 2.5% vs 2.0% cap)", () => {
    const candidate: Product = {
      name: "Excess Extra Ingredient",
      manufacturer: "BioBlend",
      composition: { A: 35, B: 45, C: 10, D: 7.5, E: 2.5 },
    };

    const result = matchProduct(referenceProduct, candidate, defaultConfig);
    expect(result.category).toBe("NO_MATCH");
    expect(result.explanation).toContain("Extra ingredient exceeding 2% limit: E (2.5%)");
  });

  it("Edge Case 4: Extra ingredient count exceeds limit (2 extra ingredients when cap is 1)", () => {
    const candidate: Product = {
      name: "Too Many Extra Ingredients",
      manufacturer: "MultiBlend",
      composition: { A: 35, B: 45, C: 10, D: 8, E: 1, F: 1 },
    };

    const result = matchProduct(referenceProduct, candidate, defaultConfig);
    expect(result.category).toBe("NO_MATCH");
    expect(result.explanation).toContain("Contains 2 extra ingredients (allowed max: 1)");
  });

  it("Edge Case 5: Dynamic config sensitivity (Product Q fails if tolerance is reduced to 2.0pp)", () => {
    const candidate: Product = {
      name: "Product Q",
      manufacturer: "Delta Bio",
      composition: { A: 32, B: 45, C: 13, D: 10 },
    };

    const tightConfig: MatchConfig = {
      ...defaultConfig,
      tolerance_pp: 2.0,
    };

    const result = matchProduct(referenceProduct, candidate, tightConfig);
    expect(result.category).toBe("NO_MATCH");
    expect(result.explanation).toContain("Exceeds ±2pp tolerance");
  });

  it("Edge Case 6: Single-ingredient reference product", () => {
    const singleRef: Product = {
      name: "Pure API A",
      manufacturer: "Us",
      composition: { A: 100 },
    };

    const exactCand: Product = {
      name: "Pure A",
      manufacturer: "Competitor",
      composition: { A: 100 },
    };

    const closeCand: Product = {
      name: "Almost Pure A",
      manufacturer: "Competitor 2",
      composition: { A: 98, Excipient: 2 },
    };

    expect(matchProduct(singleRef, exactCand, defaultConfig).category).toBe("EXACT_MATCH");
    expect(matchProduct(singleRef, closeCand, defaultConfig).category).toBe("CLOSE_MATCH");
  });

  it("Edge Case 7: Empty catalog handles gracefully", () => {
    const results = matchCatalog(referenceProduct, [], defaultConfig);
    expect(results).toEqual([]);
  });
});
