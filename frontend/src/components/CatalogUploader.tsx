"use client";

import React, { useRef } from "react";
import { UploadCloud, FileJson, Database } from "lucide-react";

interface Props {
  catalogCount: number;
  onLoadSample: () => void;
  onFileUpload: (jsonContent: string) => void;
}

export function CatalogUploader({
  catalogCount,
  onLoadSample,
  onFileUpload,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      onFileUpload(content);
    };
    reader.readAsText(file);
    // Reset value so same file can be re-selected if edited
    e.target.value = "";
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center space-x-2 mb-3">
          <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">
              Catalog Dataset
            </h2>
            <p className="text-xs text-slate-500">
              Loaded:{" "}
              <span className="font-semibold text-slate-900">
                {catalogCount} candidate products
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5 mt-2">
        <button
          onClick={onLoadSample}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-all shadow-sm"
        >
          <FileJson className="w-4 h-4 text-indigo-600" />
          Load Sample Catalog
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all shadow-sm"
        >
          <UploadCloud className="w-4 h-4 text-slate-600" />
          Upload JSON File
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
