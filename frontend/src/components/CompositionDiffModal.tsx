"use client";

import React from "react";
import { MatchResult, Product } from "../types";
import { X, ArrowRight, CheckCircle2, AlertCircle, XCircle } from "lucide-react";

interface Props {
  result: MatchResult | null;
  referenceProduct: Product;
  onClose: () => void;
}

export function CompositionDiffModal({
  result,
  referenceProduct,
  onClose,
}: Props) {
  if (!result) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                {result.product.name}
              </h3>
              <span className="text-xs text-slate-500">
                by {result.product.manufacturer}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">{result.explanation}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider pb-2 border-b border-slate-100">
            <span>Ingredient</span>
            <div className="flex items-center gap-6">
              <span className="w-20 text-right">Reference ({referenceProduct.name})</span>
              <span className="w-4 text-center"></span>
              <span className="w-20 text-right">Candidate</span>
              <span className="w-16 text-right">Delta</span>
            </div>
          </div>

          <div className="space-y-2">
            {result.diffs.map((diff) => {
              const isExtra = diff.type === "EXTRA";
              const isMissing = diff.type === "MISSING";
              const isShared = diff.type === "SHARED";
              const isZeroDiff = Math.abs(diff.diffPp) <= 0.01;

              return (
                <div
                  key={diff.ingredient}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50 text-xs hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isShared && isZeroDiff && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    )}
                    {isShared && !isZeroDiff && (
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                    )}
                    {isExtra && <AlertCircle className="w-4 h-4 text-blue-500" />}
                    {isMissing && <XCircle className="w-4 h-4 text-rose-500" />}
                    <span className="font-bold text-slate-800">
                      Ingredient {diff.ingredient}
                    </span>
                    {isExtra && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-100">
                        Extra
                      </span>
                    )}
                    {isMissing && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-600 border border-rose-100">
                        Missing
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-6 font-mono text-xs">
                    <span className="w-20 text-right text-slate-600">
                      {diff.referencePct.toFixed(1)}%
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                    <span className="w-20 text-right font-semibold text-slate-900">
                      {diff.candidatePct.toFixed(1)}%
                    </span>
                    <span
                      className={`w-16 text-right font-bold ${
                        isZeroDiff
                          ? "text-emerald-600"
                          : diff.diffPp > 0
                          ? "text-amber-600"
                          : "text-rose-600"
                      }`}
                    >
                      {isZeroDiff
                        ? "0.0pp"
                        : `${diff.diffPp > 0 ? "+" : ""}${diff.diffPp.toFixed(1)}pp`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Metrics Footer */}
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 bg-slate-50 rounded-lg">
              <span className="text-slate-400 block text-[10px]">Shared APIs</span>
              <span className="font-bold text-slate-800">
                {result.metrics.sharedCount}
              </span>
            </div>
            <div className="p-2 bg-slate-50 rounded-lg">
              <span className="text-slate-400 block text-[10px]">Extra Ingredients</span>
              <span className="font-bold text-slate-800">
                {result.metrics.extraCount}
              </span>
            </div>
            <div className="p-2 bg-slate-50 rounded-lg">
              <span className="text-slate-400 block text-[10px]">Similarity Score</span>
              <span className="font-bold text-indigo-600">
                {result.similarityScore}%
              </span>
            </div>
          </div>
        </div>

        {/* Modal Close Button */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
          >
            Close Diff View
          </button>
        </div>
      </div>
    </div>
  );
}
