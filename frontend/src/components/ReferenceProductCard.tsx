"use client";

import React from "react";
import { Product } from "../types";
import { Beaker, ShieldCheck } from "lucide-react";

interface Props {
  product: Product;
}

const COLOR_PALETTE = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-rose-500",
  "bg-cyan-500",
];

export function ReferenceProductCard({ product }: Props) {
  const entries = Object.entries(product.composition).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((acc, curr) => acc + curr[1], 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
            <Beaker className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">
              Reference Product
            </h2>
            <p className="text-lg font-bold text-slate-900">
              {product.name}{" "}
              <span className="text-xs font-normal text-slate-500">
                ({product.manufacturer})
              </span>
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          Sum: {total.toFixed(1)}%
        </span>
      </div>

      {/* Composition Multi-color Progress Bar */}
      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex mb-4">
        {entries.map(([ingredient, pct], idx) => {
          const color = COLOR_PALETTE[idx % COLOR_PALETTE.length];
          return (
            <div
              key={ingredient}
              style={{ width: `${(pct / (total || 100)) * 100}%` }}
              className={`${color} h-full transition-all duration-300`}
              title={`${ingredient}: ${pct}%`}
            />
          );
        })}
      </div>

      {/* Ingredient Breakdown Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {entries.map(([ingredient, pct], idx) => {
          const color = COLOR_PALETTE[idx % COLOR_PALETTE.length];
          return (
            <div
              key={ingredient}
              className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-slate-50/70"
            >
              <div className="flex items-center space-x-2">
                <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                <span className="text-xs font-semibold text-slate-700">
                  {ingredient}
                </span>
              </div>
              <span className="text-xs font-bold text-slate-900">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
