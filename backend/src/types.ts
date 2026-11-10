import { z } from "zod";

export const ProductSchema = z.object({
  name: z.string().min(1, "Product name cannot be empty"),
  manufacturer: z.string().min(1, "Manufacturer cannot be empty"),
  composition: z.record(z.string(), z.number().nonnegative("Ingredient percentage must be non-negative")),
});

export type Product = z.infer<typeof ProductSchema>;

export const MatchConfigSchema = z.object({
  tolerance_pp: z.number().min(0, "Tolerance must be non-negative").default(3.0),
  max_extra_ingredients: z.number().int().min(0, "Max extra ingredients must be >= 0").default(1),
  max_extra_percentage: z.number().min(0, "Max extra percentage must be >= 0").default(2.0),
  epsilon: z.number().min(0, "Epsilon must be non-negative").default(0.01),
});

export type MatchConfig = z.infer<typeof MatchConfigSchema>;

export const MatchRequestSchema = z.object({
  reference_product: ProductSchema,
  catalog: z.array(ProductSchema),
  config: MatchConfigSchema.optional().default({}),
});

export type MatchRequest = z.infer<typeof MatchRequestSchema>;

export type MatchCategory = "EXACT_MATCH" | "CLOSE_MATCH" | "NO_MATCH";

export type DiffType = "SHARED" | "EXTRA" | "MISSING";

export interface IngredientDiff {
  ingredient: string;
  referencePct: number;
  candidatePct: number;
  diffPp: number; // candidatePct - referencePct
  type: DiffType;
}

export interface MatchMetrics {
  sharedCount: number;
  extraCount: number;
  missingCount: number;
  maxDiffPp: number;
  totalL1Diff: number;
}

export interface MatchResult {
  product: Product;
  category: MatchCategory;
  similarityScore: number; // 0.0 to 100.0
  explanation: string;
  diffs: IngredientDiff[];
  metrics: MatchMetrics;
}

export interface MatchResponse {
  reference_product: Product;
  total_candidates: number;
  summary: {
    exact_matches: number;
    close_matches: number;
    no_matches: number;
  };
  results: MatchResult[];
}
