# Ingredient Composition Matching App

A full-stack web application designed for raw ingredient suppliers (Active Pharmaceutical Ingredients / APIs) to identify competitor products and manufacturer sales leads whose finished products share identical or closely matched ingredient ratios.

---

## Tech Stack

- **Backend**: Node.js, Express, TypeScript, Zod, Vitest
- **Frontend**: Next.js (App Router), React, TypeScript, Tailwind CSS, Lucide React
- **Architecture**: Decoupled Client-Server architecture with clean REST contract

---

## Quickstart Setup & Run

### 1. Install Dependencies
Run in your terminal from the project root:

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
cd ..
```

### 2. Run Automated Test Suite
Run the 15 unit and edge-case tests:

```bash
cd backend
npm test
```

### 3. Start the Backend API (Port 4000)
```bash
cd backend
npm run dev
```
> Backend runs at: `http://localhost:4000`  
> Endpoints:
> - `GET  /api/health` - Health check
> - `GET  /api/sample` - Serves sample dataset (`sample_products.json`)
> - `POST /api/match`  - Evaluates catalog against reference product with configurable tolerances

### 4. Start the Frontend Dashboard (Port 3000)
In a second terminal window:

```bash
cd frontend
npm run dev
```
> Open your browser to: **`http://localhost:3000`**

---

## Features

1. **Multi-Tier Classification**:
   - **Exact Matches**: Same ingredients and percentages within floating-point safety ($\le 0.01\%$).
   - **Close Matches**: Same core ingredients within configurable tolerance (e.g. $\pm 3.0\text{pp}$), allowing configurable extra minor excipients (e.g. $\le 1$ ingredient under $2.0\%$).
   - **No Match**: Incompatible formulations or excessive extra ingredients.
2. **Granular Human-Readable Explanations**:
   - E.g.: *"1 additional ingredient (E: 2%), D differs by 2pp"*
   - E.g.: *"A differs by +15pp (exceeds ±3pp tolerance), B differs by -15pp"*
3. **Interactive Tuning Controls**:
   - Dynamic tolerance slider ($\pm\text{pp}$)
   - Max allowable extra ingredients slider
   - Max extra ingredient % slider
4. **Visual Composition Diff Viewer**:
   - Side-by-side delta inspection for each candidate product.
5. **Custom Catalog Upload**:
   - Drag-and-drop or select any custom JSON catalog file.

---

## Deliverables & Documentation

- [docs/WRITEUP.md](file:///e:/ingrediant_composition/docs/WRITEUP.md): Complete ½–1 page technical write-up addressing matching rationale, tolerance mechanics, frontend/backend separation, 100k+ scalability strategy, and future enhancements.
- [docs/PROMPTS.md](file:///e:/ingrediant_composition/docs/PROMPTS.md): Complete chronological record of the technical prompts used to design, build, test, and polish the application.
