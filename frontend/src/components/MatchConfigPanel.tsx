"use client";

import React from "react";
import { MatchConfig } from "../types";
import { SlidersHorizontal, RotateCcw } from "lucide-react";

interface Props {
  config: MatchConfig;
  onChange: (config: MatchConfig) => void;
  onReset: () => void;
}

export function MatchConfigPanel({ config, onChange, onReset }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">
              Matching Parameters
            </h2>
            <p className="text-xs text-slate-500">
              Tune tolerance and minor ingredient allowances
            </p>
          </div>
        </div>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors p-1"
          title="Reset to defaults"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Tolerance PP Slider */}
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Tolerance (±pp)
            </label>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
              ±{config.tolerance_pp.toFixed(1)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="10"
            step="0.5"
            value={config.tolerance_pp}
            onChange={(e) =>
              onChange({ ...config, tolerance_pp: parseFloat(e.target.value) })
            }
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <span className="text-[10px] text-slate-400 mt-1 block">
            Allowable % point drift on shared APIs
          </span>
        </div>

        {/* Max Extra Ingredients Count */}
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Max Extra Ingredients
            </label>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
              {config.max_extra_ingredients}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="5"
            step="1"
            value={config.max_extra_ingredients}
            onChange={(e) =>
              onChange({
                ...config,
                max_extra_ingredients: parseInt(e.target.value, 10),
              })
            }
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <span className="text-[10px] text-slate-400 mt-1 block">
            Max permitted additional minor excipients
          </span>
        </div>

        {/* Max Extra Ingredient % */}
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Max Extra Ingredient %
            </label>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
              ≤{config.max_extra_percentage.toFixed(1)}%
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="10"
            step="0.5"
            value={config.max_extra_percentage}
            onChange={(e) =>
              onChange({
                ...config,
                max_extra_percentage: parseFloat(e.target.value),
              })
            }
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <span className="text-[10px] text-slate-400 mt-1 block">
            Ceiling percentage for each extra ingredient
          </span>
        </div>
      </div>
    </div>
  );
}
