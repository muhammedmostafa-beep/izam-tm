"use client";

import { useState } from "react";
import { useFetch, apiPost, apiDelete, apiPatch } from "@/lib/api";
import { StatusBadge } from "@/components/ui/status-badge";
import { InlineCell } from "@/components/ui/inline-cell";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import Link from "next/link";
import {
  Plus, Search, ListChecks, LayoutGrid, Table2,
  MoreHorizontal, Trash2, ChevronRight, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StoryData {
  id: string;
  storyId: string;
  storyTitle: string;
  businessPriority: string | null;
  riskLevel: string | null;
  storyStatus: string | null;
  qcStatus: string | null;
  moduleFeature: string | null;
  implementationSprint: string | null;
  epic: { id: string; epicId: string; epicTitle: string } | null;
  owner: { id: string; name: string; email: string; avatarUrl: string | null } | null;
  _count: { testCases: number; sections: number; linkedBugs: number };
  createdAt: string;
}

interface StoriesResponse {
  data: StoryData[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function StoriesPage() {
  const [viewMode, setViewMode] = useState<"dashboard" | "grid">("dashboard");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newStoryTitle, setNewStoryTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const { data, loading, refetch } = useFetch<StoriesResponse>("/api/stories");
  const stories = data?.data || [];
  const filtered = stories.filter((s) => {
    const matchSearch = !search ||
      s.storyId.toLowerCase().includes(search.toLowerCase()) ||
      s.storyTitle.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || s.storyStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleCreate = async () => {
    if (!newStoryTitle.trim()) return;
    setCreating(true);
    try {
      await apiPost("/api/stories", { storyTitle: newStoryTitle.trim() });
      setNewStoryTitle("");
      setShowCreateModal(false);
      refetch();
    } catch (err) { console.error(err); }
    finally { setCreating(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this user story?")) return;
    try { await apiDelete(`/api/stories/${id}`); setMenuOpen(null); refetch(); }
    catch (err) { console.error(err); }
  };

  const handleInlineSave = async (entityId: string, field: string, value: string) => {
    await apiPatch(`/api/stories/${entityId}`, { [field]: value || null });
    refetch();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Stories</h1>
          <p className="text-sm text-muted-foreground mt-1">{data?.pagination.total || 0} stories</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
          <Plus size={16} /> New Story
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search stories..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="input pl-9 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Filter size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="input h-9 text-sm pl-8 pr-8 appearance-none cursor-pointer min-w-[140px]">
              <option value="">All Statuses</option>
              <option value="Backlog">Backlog</option>
              <option value="In Progress">In Progress</option>
              <option value="Ready for Test">Ready for Test</option>
              <option value="Done">Done</option>
            </select>
          </div>
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <button onClick={() => setViewMode("dashboard")}
              className={cn("flex items-center justify-center w-8 h-8 rounded-md transition-all",
                viewMode === "dashboard" ? "bg-background-secondary shadow-sm text-primary" : "text-muted-foreground hover:text-foreground")}
              title="Card View"><LayoutGrid size={15} /></button>
            <button onClick={() => setViewMode("grid")}
              className={cn("flex items-center justify-center w-8 h-8 rounded-md transition-all",
                viewMode === "grid" ? "bg-background-secondary shadow-sm text-primary" : "text-muted-foreground hover:text-foreground")}
              title="Table View"><Table2 size={15} /></button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass-card p-5 space-y-3">
              <div className="skeleton h-4 w-20" /><div className="skeleton h-5 w-3/4" />
              <div className="skeleton h-3 w-1/2" /><div className="flex gap-2 mt-3">
                <div className="skeleton h-5 w-16 rounded-full" /><div className="skeleton h-5 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<ListChecks size={24} className="text-muted-foreground" />}
          title="No stories yet" description="Create your first user story to start tracking requirements."
          action={<button onClick={() => setShowCreateModal(true)} className="btn btn-primary"><Plus size={16} />Create Story</button>} />
      ) : viewMode === "dashboard" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((story) => (
            <div key={story.id} className="glass-card p-5 group relative">
              <div className="absolute top-3 right-3">
                <button onClick={() => setMenuOpen(menuOpen === story.id ? null : story.id)}
                  className="btn-icon btn-ghost rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal size={16} /></button>
                {menuOpen === story.id && (<>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                  <div className="absolute right-0 top-full mt-1 w-36 bg-card border border-border rounded-lg shadow-lg z-20 py-1 animate-fade-in">
                    <button onClick={() => handleDelete(story.id)}
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/5">
                      <Trash2 size={14} /> Delete</button>
                  </div></>)}
              </div>
              <Link href={`/stories/${story.id}`} className="block">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono text-muted-foreground">{story.storyId}</span>
                  {story.epic && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{story.epic.epicId}</span>}
                </div>
                <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">{story.storyTitle}</h3>
                {story.moduleFeature && <p className="text-xs text-muted-foreground mt-1">{story.moduleFeature}</p>}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <StatusBadge value={story.storyStatus} />
                  <StatusBadge value={story.qcStatus} />
                  {story.businessPriority && <StatusBadge value={story.businessPriority} />}
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span>{story._count.testCases} tests</span>
                  <span>{story._count.linkedBugs} bugs</span>
                  <span>{story._count.sections} sections</span>
                </div>
                {story.owner && <p className="text-xs text-muted-foreground mt-2">👤 {story.owner.name}</p>}
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">ID</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Epic</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">QC Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Priority</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Risk</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Tests</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Owner</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map((story) => (
                  <tr key={story.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3"><span className="font-mono text-xs text-muted-foreground">{story.storyId}</span></td>
                    <td className="px-4 py-3 max-w-xs"><Link href={`/stories/${story.id}`} className="font-medium text-foreground hover:text-primary transition-colors line-clamp-1">{story.storyTitle}</Link></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{story.epic?.epicId || "—"}</td>
                    <td className="px-4 py-3"><InlineCell value={story.storyStatus} field="storyStatus" entityId={story.id} onSave={handleInlineSave} type="select" options={["Backlog", "In Progress", "Ready for Test", "Done"]} /></td>
                    <td className="px-4 py-3"><InlineCell value={story.qcStatus} field="qcStatus" entityId={story.id} onSave={handleInlineSave} type="select" options={["Not Started", "In Progress", "Passed", "Failed", "Blocked"]} /></td>
                    <td className="px-4 py-3"><InlineCell value={story.businessPriority} field="businessPriority" entityId={story.id} onSave={handleInlineSave} type="select" options={["High", "Medium", "Low"]} /></td>
                    <td className="px-4 py-3"><InlineCell value={story.riskLevel} field="riskLevel" entityId={story.id} onSave={handleInlineSave} type="select" options={["High", "Medium", "Low"]} /></td>
                    <td className="px-4 py-3 text-center">{story._count.testCases}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{story.owner?.name || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/stories/${story.id}`} className="btn-ghost btn-sm btn inline-flex items-center gap-1">View <ChevronRight size={14} /></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={showCreateModal} onClose={() => { setShowCreateModal(false); setNewStoryTitle(""); }}
        title="Create User Story" description="Add a new user story to track">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Story Title <span className="text-destructive">*</span></label>
            <input type="text" value={newStoryTitle} onChange={(e) => setNewStoryTitle(e.target.value)}
              placeholder="e.g., As a user I want to..." className="input" autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { setShowCreateModal(false); setNewStoryTitle(""); }} className="btn btn-outline">Cancel</button>
            <button onClick={handleCreate} disabled={!newStoryTitle.trim() || creating} className="btn btn-primary disabled:opacity-50">
              {creating ? "Creating..." : "Create Story"}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
