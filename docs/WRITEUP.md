# Engineering Write-Up: Ingredient Composition Matcher

### 1. Matching & Similarity Approach
At its core, this problem isn't just about calculating vector distance; it's about business classification. A product with 98% similarity isn't useful if it completely omitted a critical active ingredient (API). 

We designed a two-step approach:
1. **Rule-Based Classifier**: We first classify every candidate into one of three distinct buckets:
   - **Exact Match**: The candidate contains the exact same ingredients with percentages matching within a tiny safety epsilon (0.01%) to account for floating-point imprecision.
   - **Close Match**: The candidate contains all core active ingredients, keeps percentage deviations within the allowed tolerance threshold (e.g. ±3 percentage points), and allows a small, configurable number of minor extra ingredients (e.g. 1 extra binder or stabilizer under 2%).
   - **No Match**: Any product failing the rules above (e.g., missing an active ingredient, having an extra ingredient at 20%, or having ratios wildly outside tolerance).
2. **Normalized Similarity Scoring**: Within each bucket, products are ranked using normalized Manhattan distance (L1 difference). Because compositions sum to 100%, the maximum total absolute difference is 200%. Dividing total difference by 2 gives a clean, intuitive 0–100% similarity score.

---

### 2. Tolerance & Extra Ingredient Handling
In pharma formulation, recipes vary slightly due to supplier grades, excipients, and stability needs:
- **Tolerance (±pp)**: We compare percentage points directly rather than relative percentages. For example, if a reference product has 35% of Ingredient A, a ±3pp tolerance means anything between 32% and 38% passes. This avoids mathematical distortion on low-percentage ingredients.
- **Extra Ingredients**: Products often include trace additives like binders, colorants, or preservatives. We allow users to configure both the maximum count of extra ingredients ($N$) and the maximum individual percentage allowed ($X\%$). A product with 1% extra excipient qualifies as a close match, while a product with 20% of an unknown substance is immediately flagged as a non-match.
- **Clear Explanations**: Instead of just returning a score, we generate plain-English explanations for every decision (e.g., *"1 additional ingredient (E: 2%), D differs by 2pp"* or *"Exceeds ±3pp tolerance: A differs by +15pp"*).

---

### 3. Frontend vs. Backend Responsibility Split
- **Backend (Node.js + Express + TypeScript)**:
  - Serves as the single source of truth for all matching logic, scoring algorithms, and data validation (using Zod schemas).
  - Kept stateless and deterministic so it can be integrated into batch CLI tools, database jobs, or automated test pipelines without UI dependencies.
- **Frontend (Next.js + React + Tailwind CSS)**:
  - Focuses on user workflows: dynamic parameter sliders (tolerance, extra ingredient limits), custom file upload, and real-time re-ranking.
  - Includes a visual side-by-side diff modal so analysts can immediately spot formula differences rather than digging through raw numbers.

---

### 4. Scaling to 100k+ Products
Evaluating 100,000 products naively with $O(N \times M)$ comparisons per search would quickly degrade server response times. Here is how we address scale:

1. **Inverted Index Pre-Filtering**: Map each ingredient to the set of product IDs containing it. Since any valid match must contain the reference product's high-volume core ingredients, we can perform an $O(1)$ set intersection across those core ingredients. This prunes 90%–95% of irrelevant catalog items in sub-millisecond time before performing any floating-point arithmetic.
2. **Database Bounding-Box Indexing**: In a relational database (e.g., PostgreSQL), we would store compositions with compound B-tree or GiST indexes, allowing SQL queries to pre-filter candidates:  
   `WHERE ingredient_a BETWEEN 32 AND 38 AND ingredient_b BETWEEN 42 AND 48`.
3. **Sparse Vector Search**: Compositions can be indexed as sparse vectors using extensions like `pgvector` with Manhattan distance queries to retrieve top-$K$ candidates in logarithmic time.
4. **Pagination**: The API would stream paginated results (e.g., 50 items per page) using keyset/cursor pagination rather than serializing all 100k records over HTTP.

---

### 5. What We Would Do Differently With More Time
1. **Chemical Synonym & CAS Number Mapping**: Real pharma products often use different naming conventions for the same molecule (e.g., "Acetaminophen" vs "Paracetamol"). We would add an ingredient alias/CAS registry.
2. **Batch Portfolio Matching**: Allow users to upload multiple reference products at once and generate an opportunity matrix showing which manufacturers match across multiple product lines.
3. **One-Click Export**: Add CSV and PDF export functionality for sales reps to immediately share lead lists with account executives.
