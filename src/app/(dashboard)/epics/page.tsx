"use client";

import { useState } from "react";
import { useFetch, apiPost, apiDelete } from "@/lib/api";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import Link from "next/link";
import {
  Plus,
  Search,
  FileText,
  TestTube2,
  Bug,
  TrendingUp,
  LayoutGrid,
  Table2,
  MoreHorizontal,
  Trash2,
  Pencil,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EpicStats {
  stories: number;
  testCases: number;
  bugs: number;
  storiesWithCoverage: number;
  coveragePct: number;
}

interface EpicData {
  id: string;
  epicId: string;
  epicTitle: string;
  owner: { id: string; name: string; email: string; avatarUrl: string | null } | null;
  stats: EpicStats;
  createdAt: string;
  updatedAt: string;
}

interface EpicsResponse {
  data: EpicData[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function EpicsPage() {
  const [viewMode, setViewMode] = useState<"dashboard" | "grid">("dashboard");
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEpicTitle, setNewEpicTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const { data, loading, refetch } = useFetch<EpicsResponse>("/api/epics");
  const epics = data?.data || [];
  const filteredEpics = search
    ? epics.filter(
        (e) =>
          e.epicId.toLowerCase().includes(search.toLowerCase()) ||
          e.epicTitle.toLowerCase().includes(search.toLowerCase())
      )
    : epics;

  const handleCreate = async () => {
    if (!newEpicTitle.trim()) return;
    setCreating(true);
    try {
      await apiPost("/api/epics", { epicTitle: newEpicTitle.trim() });
      setNewEpicTitle("");
      setShowCreateModal(false);
      refetch();
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this epic? This will also remove related stories.")) return;
    try {
      await apiDelete(`/api/epics/${id}`);
      setMenuOpen(null);
      refetch();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Epics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data?.pagination.total || 0} epics in total
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          <Plus size={16} />
          New Epic
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search epics..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("dashboard")}
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-md transition-all",
              viewMode === "dashboard"
                ? "bg-background-secondary shadow-sm text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Card View"
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-md transition-all",
              viewMode === "grid"
                ? "bg-background-secondary shadow-sm text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Table View"
          >
            <Table2 size={15} />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass-card p-5 space-y-3">
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-5 w-3/4" />
              <div className="skeleton h-3 w-1/2" />
              <div className="flex gap-4 mt-4">
                <div className="skeleton h-8 w-16" />
                <div className="skeleton h-8 w-16" />
                <div className="skeleton h-8 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredEpics.length === 0 ? (
        <EmptyState
          icon={<FileText size={24} className="text-muted-foreground" />}
          title="No epics yet"
          description="Create your first epic to start building the traceability matrix."
          action={
            <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
              <Plus size={16} />
              Create Epic
            </button>
          }
        />
      ) : viewMode === "dashboard" ? (
        /* ── Dashboard / Card View ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEpics.map((epic) => (
            <div key={epic.id} className="glass-card p-5 group relative">
              {/* Menu */}
              <div className="absolute top-3 right-3">
                <button
                  onClick={() => setMenuOpen(menuOpen === epic.id ? null : epic.id)}
                  className="btn-icon btn-ghost rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal size={16} />
                </button>
                {menuOpen === epic.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                    <div className="absolute right-0 top-full mt-1 w-36 bg-card border border-border rounded-lg shadow-lg z-20 py-1 animate-fade-in">
                      <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-foreground hover:bg-muted">
                        <Pencil size={14} /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(epic.id)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/5"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </>
                )}
              </div>

              <Link href={`/epics/${epic.id}`} className="block">
                <p className="text-xs font-mono text-muted-foreground">{epic.epicId}</p>
                <h3 className="text-base font-semibold text-foreground mt-1 group-hover:text-primary transition-colors line-clamp-2">
                  {epic.epicTitle}
                </h3>

                {epic.owner && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Owner: {epic.owner.name}
                  </p>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-center text-primary mb-1">
                      <FileText size={14} />
                    </div>
                    <p className="text-lg font-bold text-foreground">{epic.stats.stories}</p>
                    <p className="text-[10px] text-muted-foreground">Stories</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-center text-success mb-1">
                      <TestTube2 size={14} />
                    </div>
                    <p className="text-lg font-bold text-foreground">{epic.stats.testCases}</p>
                    <p className="text-[10px] text-muted-foreground">Tests</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-center text-destructive mb-1">
                      <Bug size={14} />
                    </div>
                    <p className="text-lg font-bold text-foreground">{epic.stats.bugs}</p>
                    <p className="text-[10px] text-muted-foreground">Bugs</p>
                  </div>
                </div>

                {/* Coverage Bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <TrendingUp size={12} /> Coverage
                    </span>
                    <span className="font-semibold text-foreground">{epic.stats.coveragePct}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${epic.stats.coveragePct}%`,
                        background:
                          epic.stats.coveragePct >= 80
                            ? "#22C55E"
                            : epic.stats.coveragePct >= 50
                            ? "#F59E0B"
                            : "#EF4444",
                      }}
                    />
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      ) : (
        /* ── Grid / Table View ── */
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Epic ID</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Owner</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Stories</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Tests</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Bugs</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Coverage</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEpics.map((epic) => (
                  <tr key={epic.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-muted-foreground">{epic.epicId}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/epics/${epic.id}`} className="font-medium text-foreground hover:text-primary transition-colors">
                        {epic.epicTitle}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {epic.owner?.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-center">{epic.stats.stories}</td>
                    <td className="px-4 py-3 text-center">{epic.stats.testCases}</td>
                    <td className="px-4 py-3 text-center">{epic.stats.bugs}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${epic.stats.coveragePct}%`,
                              background: epic.stats.coveragePct >= 80 ? "#22C55E" : epic.stats.coveragePct >= 50 ? "#F59E0B" : "#EF4444",
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium w-8">{epic.stats.coveragePct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/epics/${epic.id}`} className="btn-ghost btn-sm btn inline-flex items-center gap-1">
                        View <ChevronRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => { setShowCreateModal(false); setNewEpicTitle(""); }}
        title="Create New Epic"
        description="Add a new epic to the traceability matrix"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Epic Title <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={newEpicTitle}
              onChange={(e) => setNewEpicTitle(e.target.value)}
              placeholder="e.g., User Authentication Module"
              className="input"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => { setShowCreateModal(false); setNewEpicTitle(""); }}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!newEpicTitle.trim() || creating}
              className="btn btn-primary disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Epic"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
