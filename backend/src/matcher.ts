import {
  Product,
  MatchConfig,
  MatchResult,
  MatchCategory,
  IngredientDiff,
  MatchMetrics,
} from "./types.js";

/**
 * Normalizes ingredient names: trims whitespace and capitalizes standard names.
 */
export function normalizeIngredientName(name: string): string {
  return name.trim();
}

/**
 * Normalizes a product composition map:
 * - trims ingredient names
 * - filters out any near-zero or negative noise below epsilon
 */
export function normalizeComposition(
  composition: Record<string, number>,
  epsilon: number = 0.01
): Record<string, number> {
  const normalized: Record<string, number> = {};
  for (const [key, rawValue] of Object.entries(composition)) {
    const cleanKey = normalizeIngredientName(key);
    const value = Math.max(0, Number(rawValue) || 0);
    if (value > epsilon) {
      normalized[cleanKey] = (normalized[cleanKey] || 0) + value;
    }
  }
  return normalized;
}

/**
 * Helper to round to specified decimal places for clean display and float safety.
 */
export function roundTo(val: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

/**
 * Matches a single candidate product against a reference product according to MatchConfig.
 */
export function matchProduct(
  reference: Product,
  candidate: Product,
  config: MatchConfig
): MatchResult {
  const {
    tolerance_pp = 3.0,
    max_extra_ingredients = 1,
    max_extra_percentage = 2.0,
    epsilon = 0.01,
  } = config;

  const refComp = normalizeComposition(reference.composition, epsilon);
  const candComp = normalizeComposition(candidate.composition, epsilon);

  // Collect all unique ingredients from both products
  const allIngredients = Array.from(
    new Set([...Object.keys(refComp), ...Object.keys(candComp)])
  ).sort();

  const diffs: IngredientDiff[] = [];
  const extraIngredients: { name: string; pct: number }[] = [];
  const missingIngredients: { name: string; pct: number }[] = [];
  const toleranceViolations: { name: string; diffPp: number }[] = [];
  const withinToleranceDiffs: { name: string; diffPp: number }[] = [];

  let totalL1Diff = 0;
  let maxDiffPp = 0;
  let sharedCount = 0;

  for (const ing of allIngredients) {
    const refPct = refComp[ing] || 0;
    const candPct = candComp[ing] || 0;
    const rawDiff = candPct - refPct;
    const absDiff = Math.abs(rawDiff);
    totalL1Diff += absDiff;

    if (absDiff > maxDiffPp) {
      maxDiffPp = absDiff;
    }

    if (refPct > epsilon && candPct > epsilon) {
      // Shared ingredient
      sharedCount++;
      const isExactWithinEpsilon = absDiff <= epsilon;
      diffs.push({
        ingredient: ing,
        referencePct: roundTo(refPct, 2),
        candidatePct: roundTo(candPct, 2),
        diffPp: isExactWithinEpsilon ? 0 : roundTo(rawDiff, 2),
        type: "SHARED",
      });

      if (!isExactWithinEpsilon) {
        if (absDiff <= tolerance_pp + epsilon) {
          withinToleranceDiffs.push({ name: ing, diffPp: roundTo(rawDiff, 2) });
        } else {
          toleranceViolations.push({ name: ing, diffPp: roundTo(rawDiff, 2) });
        }
      }
    } else if (candPct > epsilon && refPct <= epsilon) {
      // Extra ingredient present in candidate only
      extraIngredients.push({ name: ing, pct: roundTo(candPct, 2) });
      diffs.push({
        ingredient: ing,
        referencePct: 0,
        candidatePct: roundTo(candPct, 2),
        diffPp: roundTo(candPct, 2),
        type: "EXTRA",
      });
    } else if (refPct > epsilon && candPct <= epsilon) {
      // Missing ingredient from candidate that is present in reference
      missingIngredients.push({ name: ing, pct: roundTo(refPct, 2) });
      diffs.push({
        ingredient: ing,
        referencePct: roundTo(refPct, 2),
        candidatePct: 0,
        diffPp: -roundTo(refPct, 2),
        type: "MISSING",
      });
    }
  }

  const metrics: MatchMetrics = {
    sharedCount,
    extraCount: extraIngredients.length,
    missingCount: missingIngredients.length,
    maxDiffPp: roundTo(maxDiffPp, 2),
    totalL1Diff: roundTo(totalL1Diff, 2),
  };

  // 1. Check for EXACT MATCH
  const isExact =
    missingIngredients.length === 0 &&
    extraIngredients.length === 0 &&
    toleranceViolations.length === 0 &&
    withinToleranceDiffs.length === 0;

  if (isExact) {
    return {
      product: candidate,
      category: "EXACT_MATCH",
      similarityScore: 100.0,
      explanation: `Exact match: All ${sharedCount} ingredients identical to reference (within ${epsilon}% epsilon).`,
      diffs,
      metrics,
    };
  }

  // 2. Check for CLOSE MATCH vs NO MATCH
  const reasons: string[] = [];
  let isCloseMatch = true;

  // Rule A: Missing core ingredients
  if (missingIngredients.length > 0) {
    isCloseMatch = false;
    const missingList = missingIngredients
      .map((m) => `${m.name} (${m.pct}%)`)
      .join(", ");
    reasons.push(`Missing core ingredient${missingIngredients.length > 1 ? "s" : ""}: ${missingList}`);
  }

  // Rule B: Extra ingredients count & percentage check
  if (extraIngredients.length > max_extra_ingredients) {
    isCloseMatch = false;
    reasons.push(
      `Contains ${extraIngredients.length} extra ingredients (allowed max: ${max_extra_ingredients})`
    );
  }

  const excessiveExtras = extraIngredients.filter(
    (e) => e.pct > max_extra_percentage + epsilon
  );
  if (excessiveExtras.length > 0) {
    isCloseMatch = false;
    const excessiveList = excessiveExtras
      .map((e) => `${e.name} (${e.pct}%)`)
      .join(", ");
    reasons.push(
      `Extra ingredient exceeding ${max_extra_percentage}% limit: ${excessiveList}`
    );
  }

  // Rule C: Shared ingredients tolerance check
  if (toleranceViolations.length > 0) {
    isCloseMatch = false;
    const violationList = toleranceViolations
      .map((v) => `${v.name} differs by ${v.diffPp > 0 ? "+" : ""}${v.diffPp}pp`)
      .join(", ");
    reasons.push(
      `Exceeds ±${tolerance_pp}pp tolerance: ${violationList}`
    );
  }

  // Compute normalized similarity score (0 - 100%)
  // Sum of absolute differences can reach at most ~200% (if completely disjoint 100% compositions)
  const rawScore = 100 - totalL1Diff / 2;
  const similarityScore = Math.max(0, Math.min(99.9, roundTo(rawScore, 1)));

  if (isCloseMatch) {
    const closeDescriptions: string[] = [];
    if (extraIngredients.length > 0) {
      const extraList = extraIngredients
        .map((e) => `${e.name}, ${e.pct}%`)
        .join("; ");
      closeDescriptions.push(
        `${extraIngredients.length} additional ingredient (${extraList})`
      );
    }
    if (withinToleranceDiffs.length > 0) {
      const diffList = withinToleranceDiffs
        .map((d) => `${d.name} differs by ${Math.abs(d.diffPp)}pp`)
        .join(", ");
      closeDescriptions.push(diffList);
    }

    const explanation =
      closeDescriptions.length > 0
        ? `Close match: ${closeDescriptions.join("; ")} (within ±${tolerance_pp}pp tolerance)`
        : "Close match within configured tolerance parameters.";

    return {
      product: candidate,
      category: "CLOSE_MATCH",
      similarityScore,
      explanation,
      diffs,
      metrics,
    };
  }

  // Otherwise, it's NO_MATCH
  const explanation = `No match: ${reasons.join("; ")}`;
  return {
    product: candidate,
    category: "NO_MATCH",
    similarityScore,
    explanation,
    diffs,
    metrics,
  };
}

/**
 * Matches an entire catalog of products against a reference product.
 * Results are sorted:
 * 1. EXACT_MATCH first
 * 2. CLOSE_MATCH second
 * 3. NO_MATCH third
 * Within each category, sorted descending by similarityScore.
 */
export function matchCatalog(
  reference: Product,
  catalog: Product[],
  config: MatchConfig
): MatchResult[] {
  const categoryOrder: Record<MatchCategory, number> = {
    EXACT_MATCH: 1,
    CLOSE_MATCH: 2,
    NO_MATCH: 3,
  };

  const results = catalog.map((candidate) =>
    matchProduct(reference, candidate, config)
  );

  return results.sort((a, b) => {
    const catDiff = categoryOrder[a.category] - categoryOrder[b.category];
    if (catDiff !== 0) return catDiff;
    return b.similarityScore - a.similarityScore;
  });
}
