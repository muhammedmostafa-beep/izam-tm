"use client";

import { useState } from "react";
import { useFetch, apiPost, apiPatch } from "@/lib/api";
import { StatusBadge } from "@/components/ui/status-badge";
import { InlineCell } from "@/components/ui/inline-cell";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import Link from "next/link";
import {
  Plus, Search, TestTube2, LayoutGrid, Table2, Filter, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TCData {
  id: string;
  testCaseId: string;
  testCaseTitle: string;
  testLevel: string | null;
  testType: string | null;
  scenarioClassification: string | null;
  priority: string | null;
  automationStatus: string | null;
  executionStatus: string | null;
  requirementCoverage: string | null;
  story: { id: string; storyId: string; storyTitle: string } | null;
  storySection: { id: string; sectionTitle: string } | null;
  reviewer: { id: string; name: string; avatarUrl: string | null } | null;
  _count: { defectLinks: number };
  createdAt: string;
}

interface TCResponse {
  data: TCData[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function TestCasesPage() {
  const [viewMode, setViewMode] = useState<"dashboard" | "grid">("grid");
  const [search, setSearch] = useState("");
  const [executionFilter, setExecutionFilter] = useState("");
  const [classificationFilter, setClassificationFilter] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTCTitle, setNewTCTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const { data, loading, refetch } = useFetch<TCResponse>("/api/test-cases");
  const tcs = data?.data || [];
  const filtered = tcs.filter((tc) => {
    const matchSearch = !search ||
      tc.testCaseId.toLowerCase().includes(search.toLowerCase()) ||
      tc.testCaseTitle.toLowerCase().includes(search.toLowerCase());
    const matchExec = !executionFilter || tc.executionStatus === executionFilter;
    const matchClass = !classificationFilter || tc.scenarioClassification === classificationFilter;
    return matchSearch && matchExec && matchClass;
  });

  const handleCreate = async () => {
    if (!newTCTitle.trim()) return;
    setCreating(true);
    try {
      await apiPost("/api/test-cases", { testCaseTitle: newTCTitle.trim() });
      setNewTCTitle("");
      setShowCreateModal(false);
      refetch();
    } catch (err) { console.error(err); }
    finally { setCreating(false); }
  };

  const handleInlineSave = async (entityId: string, field: string, value: string) => {
    await apiPatch(`/api/test-cases/${entityId}`, { [field]: value || null });
    refetch();
  };

  // Summary stats
  const stats = {
    total: filtered.length,
    passed: filtered.filter((t) => t.executionStatus === "Passed").length,
    failed: filtered.filter((t) => t.executionStatus === "Failed").length,
    notRun: filtered.filter((t) => t.executionStatus === "Not Run").length,
    automated: filtered.filter((t) => t.automationStatus === "Automated").length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Test Cases</h1>
          <p className="text-sm text-muted-foreground mt-1">{data?.pagination.total || 0} test cases</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
          <Plus size={16} /> New Test Case
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, color: "var(--izam-primary)" },
          { label: "Passed", value: stats.passed, color: "142 71% 45%" },
          { label: "Failed", value: stats.failed, color: "0 84% 60%" },
          { label: "Not Run", value: stats.notRun, color: "220 9% 46%" },
          { label: "Automated", value: stats.automated, color: "262 83% 58%" },
        ].map((s) => (
          <div key={s.label} className="glass-card px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-xl font-bold text-foreground mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search test cases..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="input pl-9 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={executionFilter} onChange={(e) => setExecutionFilter(e.target.value)}
            className="input h-9 text-sm pr-8 appearance-none cursor-pointer min-w-[130px]">
            <option value="">Execution</option>
            <option value="Not Run">Not Run</option>
            <option value="Passed">Passed</option>
            <option value="Failed">Failed</option>
            <option value="Blocked">Blocked</option>
          </select>
          <select value={classificationFilter} onChange={(e) => setClassificationFilter(e.target.value)}
            className="input h-9 text-sm pr-8 appearance-none cursor-pointer min-w-[130px]">
            <option value="">Scenario</option>
            <option value="Happy">Happy</option>
            <option value="Negative">Negative</option>
            <option value="Edge">Edge</option>
          </select>
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <button onClick={() => setViewMode("dashboard")}
              className={cn("flex items-center justify-center w-8 h-8 rounded-md transition-all",
                viewMode === "dashboard" ? "bg-background-secondary shadow-sm text-primary" : "text-muted-foreground")}
              ><LayoutGrid size={15} /></button>
            <button onClick={() => setViewMode("grid")}
              className={cn("flex items-center justify-center w-8 h-8 rounded-md transition-all",
                viewMode === "grid" ? "bg-background-secondary shadow-sm text-primary" : "text-muted-foreground")}
              ><Table2 size={15} /></button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="glass-card p-4 space-y-2">
          {[...Array(8)].map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<TestTube2 size={24} className="text-muted-foreground" />}
          title="No test cases" description="Create test cases to verify requirements coverage."
          action={<button onClick={() => setShowCreateModal(true)} className="btn btn-primary"><Plus size={16} />Create Test Case</button>} />
      ) : viewMode === "grid" ? (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">TC ID</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Story</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Level</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Scenario</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Execution</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Automation</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Priority</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Defects</th>
              </tr></thead>
              <tbody>
                {filtered.map((tc) => (
                  <tr key={tc.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3"><span className="font-mono text-xs text-muted-foreground">{tc.testCaseId}</span></td>
                    <td className="px-4 py-3 max-w-xs"><Link href={`/test-cases/${tc.id}`} className="font-medium text-foreground hover:text-primary transition-colors line-clamp-1">{tc.testCaseTitle}</Link></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{tc.story?.storyId || "—"}</td>
                    <td className="px-4 py-3"><InlineCell value={tc.testLevel} field="testLevel" entityId={tc.id} onSave={handleInlineSave} type="select" options={["API", "UI", "Integration", "E2E"]} /></td>
                    <td className="px-4 py-3"><InlineCell value={tc.testType} field="testType" entityId={tc.id} onSave={handleInlineSave} type="select" options={["Functional", "Regression", "Integration", "UAT Support"]} /></td>
                    <td className="px-4 py-3"><InlineCell value={tc.scenarioClassification} field="scenarioClassification" entityId={tc.id} onSave={handleInlineSave} type="select" options={["Happy", "Negative", "Edge"]} /></td>
                    <td className="px-4 py-3"><InlineCell value={tc.executionStatus} field="executionStatus" entityId={tc.id} onSave={handleInlineSave} type="select" options={["Not Run", "Passed", "Failed", "Blocked"]} /></td>
                    <td className="px-4 py-3"><InlineCell value={tc.automationStatus} field="automationStatus" entityId={tc.id} onSave={handleInlineSave} type="select" options={["Automated", "Manual", "Planned", "N/A"]} /></td>
                    <td className="px-4 py-3"><InlineCell value={tc.priority} field="priority" entityId={tc.id} onSave={handleInlineSave} type="select" options={["Critical", "High", "Medium", "Low"]} /></td>
                    <td className="px-4 py-3 text-center">{tc._count.defectLinks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((tc) => (
            <div key={tc.id} className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono text-muted-foreground">{tc.testCaseId}</span>
                {tc.story && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{tc.story.storyId}</span>}
              </div>
              <h3 className="text-sm font-semibold text-foreground line-clamp-2">{tc.testCaseTitle}</h3>
              <div className="flex flex-wrap gap-1.5 mt-3">
                <StatusBadge value={tc.executionStatus} />
                <StatusBadge value={tc.scenarioClassification} />
                <StatusBadge value={tc.automationStatus} />
              </div>
              {tc.reviewer && <p className="text-xs text-muted-foreground mt-2">Reviewer: {tc.reviewer.name}</p>}
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreateModal} onClose={() => { setShowCreateModal(false); setNewTCTitle(""); }}
        title="Create Test Case" description="Add a new test case">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Test Case Title <span className="text-destructive">*</span></label>
            <input type="text" value={newTCTitle} onChange={(e) => setNewTCTitle(e.target.value)}
              placeholder="e.g., Verify login with valid credentials" className="input" autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { setShowCreateModal(false); setNewTCTitle(""); }} className="btn btn-outline">Cancel</button>
            <button onClick={handleCreate} disabled={!newTCTitle.trim() || creating} className="btn btn-primary disabled:opacity-50">
              {creating ? "Creating..." : "Create Test Case"}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
