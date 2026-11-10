import { describe, it, expect } from "vitest";
import { matchProduct, matchCatalog } from "../src/matcher.js";
import { Product, MatchConfig } from "../src/types.js";

describe("Ingredient Matcher Engine", () => {
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

  describe("Sample Dataset Matching", () => {
    it("should classify Product Y as an EXACT MATCH", () => {
      const candidate: Product = {
        name: "Product Y",
        manufacturer: "Acme Pharma",
        composition: { A: 35, B: 45, C: 10, D: 10 },
      };

      const result = matchProduct(referenceProduct, candidate, defaultConfig);
      expect(result.category).toBe("EXACT_MATCH");
      expect(result.similarityScore).toBe(100.0);
      expect(result.explanation).toContain("Exact match");
      expect(result.metrics.sharedCount).toBe(4);
      expect(result.metrics.extraCount).toBe(0);
      expect(result.metrics.missingCount).toBe(0);
    });

    it("should classify Product Z as an EXACT MATCH", () => {
      const candidate: Product = {
        name: "Product Z",
        manufacturer: "Beacon Labs",
        composition: { A: 35, B: 45, C: 10, D: 10 },
      };

      const result = matchProduct(referenceProduct, candidate, defaultConfig);
      expect(result.category).toBe("EXACT_MATCH");
      expect(result.similarityScore).toBe(100.0);
    });

    it("should classify Product P as a CLOSE MATCH (1 extra ingredient E at 2%, D off by 2pp)", () => {
      const candidate: Product = {
        name: "Product P",
        manufacturer: "Crestline Formulations",
        composition: { A: 35, B: 45, C: 10, D: 8, E: 2 },
      };

      const result = matchProduct(referenceProduct, candidate, defaultConfig);
      expect(result.category).toBe("CLOSE_MATCH");
      expect(result.similarityScore).toBeGreaterThanOrEqual(95.0);
      expect(result.explanation).toContain("1 additional ingredient");
      expect(result.explanation).toContain("E, 2%");
      expect(result.explanation).toContain("D differs by 2pp");
    });

    it("should classify Product Q as a CLOSE MATCH within ±3pp tolerance", () => {
      const candidate: Product = {
        name: "Product Q",
        manufacturer: "Delta Bio",
        composition: { A: 32, B: 45, C: 13, D: 10 },
      };

      const result = matchProduct(referenceProduct, candidate, defaultConfig);
      expect(result.category).toBe("CLOSE_MATCH");
      expect(result.explanation).toContain("A differs by 3pp");
      expect(result.explanation).toContain("C differs by 3pp");
    });

    it("should classify Product S as a CLOSE MATCH (D off by 1pp, 1 extra minor ingredient F: 1%)", () => {
      const candidate: Product = {
        name: "Product S",
        manufacturer: "Fortis Chem",
        composition: { A: 35, B: 45, C: 10, D: 9, F: 1 },
      };

      const result = matchProduct(referenceProduct, candidate, defaultConfig);
      expect(result.category).toBe("CLOSE_MATCH");
      expect(result.metrics.extraCount).toBe(1);
      expect(result.explanation).toContain("F, 1%");
    });

    it("should classify Product R as NO MATCH (wildly different ratios: A 50%, B 30%)", () => {
      const candidate: Product = {
        name: "Product R",
        manufacturer: "Everwell",
        composition: { A: 50, B: 30, C: 10, D: 10 },
      };

      const result = matchProduct(referenceProduct, candidate, defaultConfig);
      expect(result.category).toBe("NO_MATCH");
      expect(result.explanation).toContain("Exceeds ±3pp tolerance");
      expect(result.explanation).toContain("A differs by +15pp");
      expect(result.explanation).toContain("B differs by -15pp");
    });

    it("should classify Product T as NO MATCH (contains 20% unknown ingredient G)", () => {
      const candidate: Product = {
        name: "Product T",
        manufacturer: "Granite Pharma",
        composition: { A: 20, B: 20, C: 20, D: 20, G: 20 },
      };

      const result = matchProduct(referenceProduct, candidate, defaultConfig);
      expect(result.category).toBe("NO_MATCH");
      expect(result.explanation).toContain("Extra ingredient exceeding 2% limit: G (20%)");
    });
  });

  describe("Catalog Ranking Order", () => {
    it("should rank exact matches first, then close matches, then no-matches sorted by similarity", () => {
      const catalog: Product[] = [
        { name: "Product R", manufacturer: "Everwell", composition: { A: 50, B: 30, C: 10, D: 10 } },
        { name: "Product Y", manufacturer: "Acme", composition: { A: 35, B: 45, C: 10, D: 10 } },
        { name: "Product P", manufacturer: "Crestline", composition: { A: 35, B: 45, C: 10, D: 8, E: 2 } },
        { name: "Product Z", manufacturer: "Beacon", composition: { A: 35, B: 45, C: 10, D: 10 } },
      ];

      const ranked = matchCatalog(referenceProduct, catalog, defaultConfig);
      expect(ranked[0].category).toBe("EXACT_MATCH");
      expect(ranked[1].category).toBe("EXACT_MATCH");
      expect(ranked[2].category).toBe("CLOSE_MATCH");
      expect(ranked[3].category).toBe("NO_MATCH");
    });
  });
});
