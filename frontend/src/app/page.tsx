"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "../components/Header";
import { ReferenceProductCard } from "../components/ReferenceProductCard";
import { MatchConfigPanel } from "../components/MatchConfigPanel";
import { CatalogUploader } from "../components/CatalogUploader";
import { ResultsTable } from "../components/ResultsTable";
import { CompositionDiffModal } from "../components/CompositionDiffModal";
import { Product, MatchConfig, MatchResult, MatchResponse } from "../types";
import { Loader2, AlertCircle } from "lucide-react";

const DEFAULT_REFERENCE: Product = {
  name: "Product X",
  manufacturer: "Us",
  composition: { A: 35, B: 45, C: 10, D: 10 },
};

const DEFAULT_CONFIG: MatchConfig = {
  tolerance_pp: 3.0,
  max_extra_ingredients: 1,
  max_extra_percentage: 2.0,
  epsilon: 0.01,
};

export default function Home() {
  const [referenceProduct, setReferenceProduct] = useState<Product>(DEFAULT_REFERENCE);
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [config, setConfig] = useState<MatchConfig>(DEFAULT_CONFIG);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load sample dataset
  const loadSampleData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Try local backend first, fallback to static public asset
      let data: any = null;
      try {
        const res = await fetch("http://localhost:4000/api/sample");
        if (res.ok) {
          data = await res.json();
        }
      } catch {
        // Fallback to static public file
        const res = await fetch("/sample_products.json");
        if (res.ok) {
          data = await res.json();
        }
      }

      if (data && data.catalog && data.reference_product) {
        setReferenceProduct(data.reference_product);
        setCatalog(data.catalog);
      } else {
        throw new Error("Invalid sample dataset structure");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load sample dataset");
    } finally {
      setLoading(false);
    }
  }, []);

  // Run matching whenever catalog, reference, or config changes
  const executeMatch = useCallback(async () => {
    if (catalog.length === 0) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Call backend API
      const res = await fetch("http://localhost:4000/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference_product: referenceProduct,
          catalog,
          config,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with ${res.status}`);
      }

      const matchData: MatchResponse = await res.json();
      setResults(matchData.results);
    } catch (err: any) {
      setError(`Matching request failed: ${err.message}. Make sure the backend is running at http://localhost:4000.`);
    } finally {
      setLoading(false);
    }
  }, [referenceProduct, catalog, config]);

  // Initial load
  useEffect(() => {
    loadSampleData();
  }, [loadSampleData]);

  // Re-run matching when inputs change
  useEffect(() => {
    if (catalog.length > 0) {
      executeMatch();
    }
  }, [catalog, referenceProduct, config, executeMatch]);

  // Handle custom JSON upload
  const handleFileUpload = (jsonString: string) => {
    try {
      setError(null);
      const parsed = JSON.parse(jsonString);

      if (Array.isArray(parsed)) {
        setCatalog(parsed);
      } else if (parsed.catalog && Array.isArray(parsed.catalog)) {
        if (parsed.reference_product) {
          setReferenceProduct(parsed.reference_product);
        }
        setCatalog(parsed.catalog);
      } else {
        throw new Error("Uploaded JSON must contain an array of products or a 'catalog' array property.");
      }
    } catch (err: any) {
      setError(`Invalid JSON file: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top Controls Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-1">
            <ReferenceProductCard product={referenceProduct} />
          </div>
          <div className="lg:col-span-1">
            <MatchConfigPanel
              config={config}
              onChange={setConfig}
              onReset={() => setConfig(DEFAULT_CONFIG)}
            />
          </div>
          <div className="lg:col-span-1">
            <CatalogUploader
              catalogCount={catalog.length}
              onLoadSample={loadSampleData}
              onFileUpload={handleFileUpload}
            />
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
            <div className="flex-1">
              <span className="font-semibold block">Notice:</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center justify-center py-6 text-indigo-600 gap-2 text-xs font-semibold">
            <Loader2 className="w-4 h-4 animate-spin" />
            Calculating similarity rankings &amp; generating explanations...
          </div>
        )}

        {/* Results Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Ranked Match Results
              </h2>
              <p className="text-xs text-slate-500">
                Sorted by match tier (Exact &rarr; Close &rarr; No Match) and similarity score
              </p>
            </div>
          </div>

          <ResultsTable
            results={results}
            onSelectResult={(res) => setSelectedResult(res)}
          />
        </div>
      </main>

      {/* Composition Diff Modal */}
      <CompositionDiffModal
        result={selectedResult}
        referenceProduct={referenceProduct}
        onClose={() => setSelectedResult(null)}
      />
    </div>
  );
}
