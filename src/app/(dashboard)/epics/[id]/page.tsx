"use client";

import { use, useState } from "react";
import { useFetch, apiPatch, apiDelete } from "@/lib/api";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Pencil, Trash2, FileText, TestTube2, Bug,
  TrendingUp, Save, X, ChevronRight, Plus
} from "lucide-react";

interface EpicDetail {
  id: string;
  epicId: string;
  epicTitle: string;
  owner: { id: string; name: string; email: string; avatarUrl: string | null } | null;
  customFields: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  userStories: {
    id: string; storyId: string; storyTitle: string;
    storyStatus: string | null; qcStatus: string | null;
    owner: { id: string; name: string } | null;
    _count: { testCases: number };
  }[];
  linkedBugs: {
    id: string; bugId: string; bugTitle: string;
    severity: string | null; bugStatus: string | null;
  }[];
}

export default function EpicDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: epic, loading, refetch } = useFetch<EpicDetail>(`/api/epics/${id}`);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!editTitle.trim() || !epic) return;
    setSaving(true);
    try {
      await apiPatch(`/api/epics/${id}`, { epicTitle: editTitle.trim() });
      setEditing(false);
      refetch();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this epic and all its stories? This cannot be undone.")) return;
    try { await apiDelete(`/api/epics/${id}`); router.push("/epics"); }
    catch (err) { console.error(err); }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-6 w-96" />
        <div className="grid grid-cols-4 gap-4 mt-6">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
        <div className="skeleton h-64 rounded-xl mt-6" />
      </div>
    );
  }

  if (!epic) {
    return (
      <EmptyState icon={<FileText size={24} className="text-muted-foreground" />}
        title="Epic not found" description="This epic doesn't exist or was deleted."
        action={<Link href="/epics" className="btn btn-primary">Back to Epics</Link>} />
    );
  }

  const totalTests = epic.userStories.reduce((sum, s) => sum + s._count.testCases, 0);
  const storiesWithTests = epic.userStories.filter((s) => s._count.testCases > 0).length;
  const coveragePct = epic.userStories.length > 0
    ? Math.round((storiesWithTests / epic.userStories.length) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/epics" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft size={14} /> Epics
        </Link>
        <ChevronRight size={14} className="text-muted-foreground" />
        <span className="text-foreground font-medium">{epic.epicId}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-mono text-muted-foreground mb-1">{epic.epicId}</p>
          {editing ? (
            <div className="flex items-center gap-2">
              <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                className="input text-xl font-bold" autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }} />
              <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm"><Save size={14} /></button>
              <button onClick={() => setEditing(false)} className="btn btn-ghost btn-sm"><X size={14} /></button>
            </div>
          ) : (
            <h1 className="text-2xl font-bold text-foreground">{epic.epicTitle}</h1>
          )}
          {epic.owner && <p className="text-sm text-muted-foreground mt-1">Owner: {epic.owner.name}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setEditing(true); setEditTitle(epic.epicTitle); }}
            className="btn btn-outline btn-sm"><Pencil size={14} /> Edit</button>
          <button onClick={handleDelete} className="btn btn-destructive btn-sm"><Trash2 size={14} /></button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Stories", value: epic.userStories.length, icon: FileText, color: "var(--izam-primary)" },
          { label: "Test Cases", value: totalTests, icon: TestTube2, color: "142 71% 45%" },
          { label: "Bugs", value: epic.linkedBugs.length, icon: Bug, color: "0 84% 60%" },
          { label: "Coverage", value: `${coveragePct}%`, icon: TrendingUp, color: "262 83% 58%" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="glass-card kpi-card">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg"
                  style={{ background: `hsl(${s.color} / 0.1)`, color: `hsl(${s.color})` }}>
                  <Icon size={18} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-bold text-foreground">{s.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* User Stories */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">User Stories ({epic.userStories.length})</h2>
          <Link href="/stories" className="btn btn-outline btn-sm"><Plus size={14} /> Add Story</Link>
        </div>
        {epic.userStories.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">No stories linked to this epic yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">ID</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Title</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">QC</th>
                <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Tests</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Owner</th>
              </tr></thead>
              <tbody>
                {epic.userStories.map((story) => (
                  <tr key={story.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5"><span className="font-mono text-xs text-muted-foreground">{story.storyId}</span></td>
                    <td className="px-4 py-2.5">
                      <Link href={`/stories/${story.id}`} className="font-medium text-foreground hover:text-primary transition-colors">
                        {story.storyTitle}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5"><StatusBadge value={story.storyStatus} /></td>
                    <td className="px-4 py-2.5"><StatusBadge value={story.qcStatus} /></td>
                    <td className="px-4 py-2.5 text-center">{story._count.testCases}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{story.owner?.name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Linked Bugs */}
      {epic.linkedBugs.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">Linked Bugs ({epic.linkedBugs.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Bug ID</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Title</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Severity</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
              </tr></thead>
              <tbody>
                {epic.linkedBugs.map((bug) => (
                  <tr key={bug.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{bug.bugId}</td>
                    <td className="px-4 py-2.5 font-medium text-foreground">{bug.bugTitle}</td>
                    <td className="px-4 py-2.5"><StatusBadge value={bug.severity} /></td>
                    <td className="px-4 py-2.5"><StatusBadge value={bug.bugStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
