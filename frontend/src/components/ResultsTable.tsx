"use client";

import React, { useState } from "react";
import { MatchResult, MatchCategory } from "../types";
import { CheckCircle2, AlertTriangle, XCircle, Eye, ArrowUpDown } from "lucide-react";

interface Props {
  results: MatchResult[];
  onSelectResult: (result: MatchResult) => void;
}

export function ResultsTable({ results, onSelectResult }: Props) {
  const [filter, setFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");

  const filteredResults = results.filter((r) => {
    if (filter !== "ALL" && r.category !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        r.product.name.toLowerCase().includes(q) ||
        r.product.manufacturer.toLowerCase().includes(q) ||
        r.explanation.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getCategoryBadge = (category: MatchCategory) => {
    switch (category) {
      case "EXACT_MATCH":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Exact Match
          </span>
        );
      case "CLOSE_MATCH":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 shadow-sm">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Close Match
          </span>
        );
      case "NO_MATCH":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <XCircle className="w-3.5 h-3.5 text-slate-400" />
            No Match
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Table Controls Header */}
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === "ALL"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            All ({results.length})
          </button>
          <button
            onClick={() => setFilter("EXACT_MATCH")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === "EXACT_MATCH"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            Exact ({results.filter((r) => r.category === "EXACT_MATCH").length})
          </button>
          <button
            onClick={() => setFilter("CLOSE_MATCH")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === "CLOSE_MATCH"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            Close ({results.filter((r) => r.category === "CLOSE_MATCH").length})
          </button>
          <button
            onClick={() => setFilter("NO_MATCH")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === "NO_MATCH"
                ? "bg-slate-700 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            No Match ({results.filter((r) => r.category === "NO_MATCH").length})
          </button>
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Filter product, manufacturer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Results Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4">Rank</th>
              <th className="py-3 px-4">Product &amp; Manufacturer</th>
              <th className="py-3 px-4">Classification</th>
              <th className="py-3 px-4">Similarity Score</th>
              <th className="py-3 px-4">Explanation / Driver</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filteredResults.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No matching products found.
                </td>
              </tr>
            ) : (
              filteredResults.map((result, idx) => (
                <tr
                  key={`${result.product.manufacturer}-${result.product.name}`}
                  className="hover:bg-indigo-50/30 transition-colors"
                >
                  <td className="py-3.5 px-4 font-mono font-medium text-slate-400">
                    #{idx + 1}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900">
                      {result.product.name}
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      {result.product.manufacturer}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    {getCategoryBadge(result.category)}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            result.similarityScore >= 95
                              ? "bg-emerald-500"
                              : result.similarityScore >= 80
                              ? "bg-amber-500"
                              : "bg-slate-300"
                          }`}
                          style={{ width: `${result.similarityScore}%` }}
                        />
                      </div>
                      <span className="font-mono font-bold text-slate-800 text-xs">
                        {result.similarityScore}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 max-w-md">
                    <p className="line-clamp-2">{result.explanation}</p>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => onSelectResult(result)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Diff
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
