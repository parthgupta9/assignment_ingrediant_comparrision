export interface Product {
  name: string;
  manufacturer: string;
  composition: Record<string, number>;
}

export interface MatchConfig {
  tolerance_pp: number;
  max_extra_ingredients: number;
  max_extra_percentage: number;
  epsilon: number;
}

export type MatchCategory = "EXACT_MATCH" | "CLOSE_MATCH" | "NO_MATCH";
export type DiffType = "SHARED" | "EXTRA" | "MISSING";

export interface IngredientDiff {
  ingredient: string;
  referencePct: number;
  candidatePct: number;
  diffPp: number;
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
  similarityScore: number;
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
