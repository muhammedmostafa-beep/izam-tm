"use client";

import { useState } from "react";
import { useFetch, apiPost, apiPatch } from "@/lib/api";
import { StatusBadge } from "@/components/ui/status-badge";
import { InlineCell } from "@/components/ui/inline-cell";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import Link from "next/link";
import { Plus, Search, Bug, LayoutGrid, Table2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BugData {
  id: string;
  bugId: string;
  bugTitle: string;
  severity: string | null;
  priority: string | null;
  bugStatus: string | null;
  environment: string | null;
  defectLeakagePhase: string | null;
  rootCauseCategory: string | null;
  reportedDate: string | null;
  reportedBy: { id: string; name: string; avatarUrl: string | null } | null;
  linkedEpic: { id: string; epicId: string; epicTitle: string } | null;
  linkedStory: { id: string; storyId: string; storyTitle: string } | null;
  _count: { defectLinks: number };
  createdAt: string;
}

interface BugsResponse {
  data: BugData[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function BugsPage() {
  const [viewMode, setViewMode] = useState<"dashboard" | "grid">("grid");
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBugTitle, setNewBugTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const { data, loading, refetch } = useFetch<BugsResponse>("/api/bugs");
  const bugs = data?.data || [];
  const filtered = bugs.filter((b) => {
    const matchSearch = !search ||
      b.bugId.toLowerCase().includes(search.toLowerCase()) ||
      b.bugTitle.toLowerCase().includes(search.toLowerCase());
    const matchSev = !severityFilter || b.severity === severityFilter;
    const matchStatus = !statusFilter || b.bugStatus === statusFilter;
    return matchSearch && matchSev && matchStatus;
  });

  const stats = {
    total: filtered.length,
    open: filtered.filter((b) => b.bugStatus === "Open").length,
    inProgress: filtered.filter((b) => b.bugStatus === "In Progress").length,
    closed: filtered.filter((b) => b.bugStatus === "Closed").length,
    critical: filtered.filter((b) => b.severity === "Critical").length,
  };

  const handleCreate = async () => {
    if (!newBugTitle.trim()) return;
    setCreating(true);
    try {
      await apiPost("/api/bugs", { bugTitle: newBugTitle.trim() });
      setNewBugTitle("");
      setShowCreateModal(false);
      refetch();
    } catch (err) { console.error(err); }
    finally { setCreating(false); }
  };

  const handleInlineSave = async (entityId: string, field: string, value: string) => {
    await apiPatch(`/api/bugs/${entityId}`, { [field]: value || null });
    refetch();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Production Bugs</h1>
          <p className="text-sm text-muted-foreground mt-1">{data?.pagination.total || 0} bugs tracked</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
          <Plus size={16} /> Report Bug
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, color: "#6B7280" },
          { label: "Open", value: stats.open, color: "#EF4444" },
          { label: "In Progress", value: stats.inProgress, color: "#3B82F6" },
          { label: "Closed", value: stats.closed, color: "#22C55E" },
          { label: "Critical", value: stats.critical, color: "#DC2626" },
        ].map((s) => (
          <div key={s.label} className="glass-card px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search bugs..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="input pl-9 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}
            className="input h-9 text-sm pr-8 appearance-none cursor-pointer min-w-[120px]">
            <option value="">Severity</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="input h-9 text-sm pr-8 appearance-none cursor-pointer min-w-[120px]">
            <option value="">Status</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Closed">Closed</option>
            <option value="Deferred">Deferred</option>
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
        <EmptyState icon={<Bug size={24} className="text-muted-foreground" />}
          title="No bugs reported" description="Report production bugs and track their resolution."
          action={<button onClick={() => setShowCreateModal(true)} className="btn btn-primary"><Plus size={16} />Report Bug</button>} />
      ) : viewMode === "grid" ? (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Bug ID</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Severity</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Environment</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Leakage</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Root Cause</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Story</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Reporter</th>
              </tr></thead>
              <tbody>
                {filtered.map((bug) => (
                  <tr key={bug.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3"><span className="font-mono text-xs text-muted-foreground">{bug.bugId}</span></td>
                    <td className="px-4 py-3 max-w-xs"><Link href={`/bugs/${bug.id}`} className="font-medium text-foreground hover:text-primary transition-colors line-clamp-1">{bug.bugTitle}</Link></td>
                    <td className="px-4 py-3"><InlineCell value={bug.severity} field="severity" entityId={bug.id} onSave={handleInlineSave} type="select" options={["Critical", "High", "Medium", "Low"]} /></td>
                    <td className="px-4 py-3"><InlineCell value={bug.bugStatus} field="bugStatus" entityId={bug.id} onSave={handleInlineSave} type="select" options={["Open", "In Progress", "Closed", "Deferred"]} /></td>
                    <td className="px-4 py-3"><InlineCell value={bug.environment} field="environment" entityId={bug.id} onSave={handleInlineSave} type="select" options={["Production", "UAT", "Staging"]} /></td>
                    <td className="px-4 py-3"><InlineCell value={bug.defectLeakagePhase} field="defectLeakagePhase" entityId={bug.id} onSave={handleInlineSave} type="select" options={["SIT", "UAT", "Production"]} /></td>
                    <td className="px-4 py-3"><InlineCell value={bug.rootCauseCategory} field="rootCauseCategory" entityId={bug.id} onSave={handleInlineSave} type="select" options={["Requirement Gap", "Test Coverage Gap", "Implementation Defect", "Environment Issue", "Data Issue"]} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{bug.linkedStory?.storyId || "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{bug.reportedBy?.name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((bug) => (
            <div key={bug.id} className="glass-card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-muted-foreground">{bug.bugId}</span>
                <StatusBadge value={bug.severity} />
              </div>
              <h3 className="text-sm font-semibold text-foreground line-clamp-2">{bug.bugTitle}</h3>
              <div className="flex flex-wrap gap-1.5 mt-3">
                <StatusBadge value={bug.bugStatus} />
                <StatusBadge value={bug.environment} />
              </div>
              <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                <span>{bug.linkedStory?.storyId || "No story"}</span>
                <span>{bug.reportedBy?.name || "Unknown"}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreateModal} onClose={() => { setShowCreateModal(false); setNewBugTitle(""); }}
        title="Report Production Bug" description="Log a new bug found in production">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Bug Title <span className="text-destructive">*</span></label>
            <input type="text" value={newBugTitle} onChange={(e) => setNewBugTitle(e.target.value)}
              placeholder="e.g., Login page shows 500 error" className="input" autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { setShowCreateModal(false); setNewBugTitle(""); }} className="btn btn-outline">Cancel</button>
            <button onClick={handleCreate} disabled={!newBugTitle.trim() || creating} className="btn btn-primary disabled:opacity-50">
              {creating ? "Reporting..." : "Report Bug"}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
