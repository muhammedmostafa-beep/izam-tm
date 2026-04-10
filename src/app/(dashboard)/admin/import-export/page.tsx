"use client";

import { useState } from "react";
import { useFetch } from "@/lib/api";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Upload, Download, FileText, ListChecks, TestTube2, Bug,
  CheckCircle2, AlertTriangle, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ExportType = "all" | "epics" | "stories" | "test-cases" | "bugs";

interface ImportResult {
  success: boolean;
  imported: { epics: number; stories: number; testCases: number; bugs: number };
}

export default function ImportExportPage() {
  const [exportType, setExportType] = useState<ExportType>("all");
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/admin/import-export?type=${exportType}`);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `izam-tm-export-${exportType}-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error(err); }
    finally { setExporting(false); }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportResult(null); setImportError(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const importData = json.data || json;
      const res = await fetch("/api/admin/import-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(importData),
      });
      const result = await res.json();
      if (result.success) setImportResult(result);
      else setImportError(result.error || "Import failed");
    } catch (err) {
      setImportError("Invalid JSON file");
      console.error(err);
    }
    finally { setImporting(false); e.target.value = ""; }
  };

  const EXPORT_OPTIONS: { value: ExportType; label: string; icon: React.ElementType; desc: string }[] = [
    { value: "all", label: "All Data", icon: FileText, desc: "Export everything" },
    { value: "epics", label: "Epics", icon: FileText, desc: "Export all epics" },
    { value: "stories", label: "Stories", icon: ListChecks, desc: "Export with sections" },
    { value: "test-cases", label: "Test Cases", icon: TestTube2, desc: "Export with links" },
    { value: "bugs", label: "Bugs", icon: Bug, desc: "Export all bugs" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Import / Export</h1>
        <p className="text-sm text-muted-foreground mt-1">Transfer data in and out of the system</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Download size={20} className="text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Export Data</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Download data as a JSON file</p>

          <div className="grid grid-cols-1 gap-2 mb-4">
            {EXPORT_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => setExportType(opt.value)}
                className={cn("flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left",
                  exportType === opt.value
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border hover:border-primary/30 text-muted-foreground")}>
                <opt.icon size={16} />
                <div>
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <button onClick={handleExport} disabled={exporting} className="btn btn-primary w-full disabled:opacity-50">
            {exporting ? <><Loader2 size={16} className="animate-spin" /> Exporting...</> : <><Download size={16} /> Export {exportType === "all" ? "All Data" : exportType}</>}
          </button>
        </div>

        {/* Import */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Upload size={20} className="text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Import Data</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Upload a JSON file to import data. Existing records are updated, new records are created.</p>

          <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/30 transition-colors mb-4">
            <Upload size={32} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-foreground mb-1">Drop a JSON file or click to browse</p>
            <p className="text-xs text-muted-foreground mb-4">Supports previously exported izam TM files</p>
            <label className="btn btn-outline cursor-pointer inline-flex">
              <Upload size={14} /> Choose File
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>

          {importing && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <Loader2 size={16} className="animate-spin" /> Importing... 
            </div>
          )}

          {importResult && (
            <div className="bg-success/10 border border-success/20 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-success">
                <CheckCircle2 size={16} /> Import Successful
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span className="text-muted-foreground">Epics: <strong className="text-foreground">{importResult.imported.epics}</strong></span>
                <span className="text-muted-foreground">Stories: <strong className="text-foreground">{importResult.imported.stories}</strong></span>
                <span className="text-muted-foreground">Test Cases: <strong className="text-foreground">{importResult.imported.testCases}</strong></span>
                <span className="text-muted-foreground">Bugs: <strong className="text-foreground">{importResult.imported.bugs}</strong></span>
              </div>
            </div>
          )}

          {importError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle size={16} /> {importError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
