"use client";

import { use, useState } from "react";
import { useFetch, apiPatch, apiDelete } from "@/lib/api";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ChevronRight, Save, X, Pencil, Trash2, Bug,
  AlertTriangle, CheckCircle2, XCircle, FileText,
} from "lucide-react";

interface BugDetail {
  id: string; bugId: string; bugTitle: string;
  severity: string | null; priority: string | null; bugStatus: string | null;
  environment: string | null; defectLeakagePhase: string | null;
  rootCauseCategory: string | null; reportedDate: string | null;
  releaseVersion: string | null; rcaSummary: string | null;
  preventiveAction: string | null;
  requirementGap: boolean; testCoverageGap: boolean;
  newTestCaseNeeded: boolean; regressionPackUpdated: boolean;
  customFields: Record<string, unknown>;
  reportedBy: { id: string; name: string; email: string; avatarUrl: string | null } | null;
  linkedEpic: { id: string; epicId: string; epicTitle: string } | null;
  linkedStory: { id: string; storyId: string; storyTitle: string } | null;
  existingTestCase: { id: string; testCaseId: string; testCaseTitle: string } | null;
  defectLinks: { testCase: { id: string; testCaseId: string; testCaseTitle: string } }[];
  createdAt: string; updatedAt: string;
}

const LOOKUP_OPTIONS: Record<string, string[]> = {
  severity: ["Critical", "High", "Medium", "Low"],
  priority: ["Critical", "High", "Medium", "Low"],
  bugStatus: ["Open", "In Progress", "Closed", "Deferred"],
  environment: ["Production", "UAT", "Staging"],
  defectLeakagePhase: ["SIT", "UAT", "Production"],
  rootCauseCategory: ["Requirement Gap", "Test Coverage Gap", "Implementation Defect", "Environment Issue", "Data Issue"],
};

export default function BugDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: bug, loading, refetch } = useFetch<BugDetail>(`/api/bugs/${id}`);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleSave = async (field: string, value: string | boolean) => {
    try {
      await apiPatch(`/api/bugs/${id}`, { [field]: value });
      setEditingField(null);
      refetch();
    } catch (err) { console.error(err); }
  };

  const handleToggle = async (field: string, currentValue: boolean) => {
    try {
      await apiPatch(`/api/bugs/${id}`, { [field]: !currentValue });
      refetch();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this bug?")) return;
    try { await apiDelete(`/api/bugs/${id}`); router.push("/bugs"); }
    catch (err) { console.error(err); }
  };

  if (loading) return <div className="space-y-4 animate-fade-in"><div className="skeleton h-8 w-48" /><div className="skeleton h-6 w-96" /><div className="skeleton h-64 rounded-xl mt-6" /></div>;
  if (!bug) return <EmptyState icon={<Bug size={24} className="text-muted-foreground" />} title="Bug not found" description="This bug doesn't exist." action={<Link href="/bugs" className="btn btn-primary">Back to Bugs</Link>} />;

  const lookupFields = [
    { key: "severity", label: "Severity", value: bug.severity },
    { key: "priority", label: "Priority", value: bug.priority },
    { key: "bugStatus", label: "Status", value: bug.bugStatus },
    { key: "environment", label: "Environment", value: bug.environment },
    { key: "defectLeakagePhase", label: "Leakage Phase", value: bug.defectLeakagePhase },
    { key: "rootCauseCategory", label: "Root Cause", value: bug.rootCauseCategory },
  ];

  const boolFields = [
    { key: "requirementGap", label: "Requirement Gap?", value: bug.requirementGap, icon: AlertTriangle },
    { key: "testCoverageGap", label: "Test Coverage Gap?", value: bug.testCoverageGap, icon: XCircle },
    { key: "newTestCaseNeeded", label: "New TC Needed?", value: bug.newTestCaseNeeded, icon: FileText },
    { key: "regressionPackUpdated", label: "Regression Updated?", value: bug.regressionPackUpdated, icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/bugs" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"><ArrowLeft size={14} /> Bugs</Link>
        <ChevronRight size={14} className="text-muted-foreground" />
        <span className="text-foreground font-medium">{bug.bugId}</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-mono text-muted-foreground mb-1">{bug.bugId}</p>
          <h1 className="text-2xl font-bold text-foreground">{bug.bugTitle}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <StatusBadge value={bug.severity} size="md" />
            <StatusBadge value={bug.bugStatus} size="md" />
            <StatusBadge value={bug.environment} size="md" />
          </div>
        </div>
        <button onClick={handleDelete} className="btn btn-destructive btn-sm"><Trash2 size={14} /> Delete</button>
      </div>

      {/* Linked entities */}
      <div className="flex flex-wrap gap-3">
        {bug.linkedEpic && (
          <Link href={`/epics/${bug.linkedEpic.id}`} className="glass-card px-3 py-2 text-xs hover:border-primary/30 transition-colors">
            <span className="text-muted-foreground">Epic:</span> <span className="font-medium text-foreground">{bug.linkedEpic.epicId}</span>
          </Link>
        )}
        {bug.linkedStory && (
          <Link href={`/stories/${bug.linkedStory.id}`} className="glass-card px-3 py-2 text-xs hover:border-primary/30 transition-colors">
            <span className="text-muted-foreground">Story:</span> <span className="font-medium text-foreground">{bug.linkedStory.storyId}</span>
          </Link>
        )}
        {bug.existingTestCase && (
          <Link href={`/test-cases/${bug.existingTestCase.id}`} className="glass-card px-3 py-2 text-xs hover:border-primary/30 transition-colors">
            <span className="text-muted-foreground">TC:</span> <span className="font-medium text-foreground">{bug.existingTestCase.testCaseId}</span>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Attributes */}
          <div className="glass-card p-5">
            <h2 className="text-base font-semibold text-foreground mb-4">Attributes</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {lookupFields.map((f) => (
                <div key={f.key} className="group">
                  <p className="text-xs text-muted-foreground mb-1">{f.label}</p>
                  {editingField === f.key ? (
                    <div className="flex items-center gap-1">
                      <select value={editValue} onChange={(e) => setEditValue(e.target.value)} className="input h-8 text-sm flex-1" autoFocus>
                        <option value="">— None —</option>
                        {LOOKUP_OPTIONS[f.key]?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                      <button onClick={() => handleSave(f.key, editValue)} className="btn-icon btn-ghost"><Save size={12} /></button>
                      <button onClick={() => setEditingField(null)} className="btn-icon btn-ghost"><X size={12} /></button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingField(f.key); setEditValue(f.value || ""); }}
                      className="flex items-center gap-1 w-full text-left hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors">
                      {f.value ? <StatusBadge value={f.value} /> : <span className="text-sm text-muted-foreground">—</span>}
                      <Pencil size={10} className="opacity-0 group-hover:opacity-40 ml-auto shrink-0" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Boolean Flags */}
          <div className="glass-card p-5">
            <h2 className="text-base font-semibold text-foreground mb-4">Gap Analysis</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {boolFields.map((f) => {
                const Icon = f.icon;
                return (
                  <button key={f.key} onClick={() => handleToggle(f.key, f.value)}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/20 transition-all text-left">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${f.value ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{f.label}</p>
                      <p className="text-xs text-muted-foreground">{f.value ? "Yes" : "No"}</p>
                    </div>
                    <div className={`w-10 h-5 rounded-full transition-colors ${f.value ? "bg-destructive" : "bg-muted"} relative`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${f.value ? "translate-x-5" : "translate-x-0.5"}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RCA Summary */}
          <div className="glass-card p-5">
            <h2 className="text-base font-semibold text-foreground mb-2">RCA Summary</h2>
            {editingField === "rcaSummary" ? (
              <div className="space-y-2">
                <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} className="input min-h-[100px] text-sm" autoFocus />
                <div className="flex gap-2">
                  <button onClick={() => handleSave("rcaSummary", editValue)} className="btn btn-primary btn-sm"><Save size={12} /> Save</button>
                  <button onClick={() => setEditingField(null)} className="btn btn-ghost btn-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <div onClick={() => { setEditingField("rcaSummary"); setEditValue(bug.rcaSummary || ""); }}
                className="text-sm text-foreground/80 whitespace-pre-wrap cursor-pointer hover:bg-muted/30 rounded p-2 -m-2 transition-colors min-h-[50px]">
                {bug.rcaSummary || <span className="text-muted-foreground italic">Click to add RCA summary...</span>}
              </div>
            )}
          </div>

          {/* Preventive Action */}
          <div className="glass-card p-5">
            <h2 className="text-base font-semibold text-foreground mb-2">Preventive Action</h2>
            {editingField === "preventiveAction" ? (
              <div className="space-y-2">
                <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} className="input min-h-[100px] text-sm" autoFocus />
                <div className="flex gap-2">
                  <button onClick={() => handleSave("preventiveAction", editValue)} className="btn btn-primary btn-sm"><Save size={12} /> Save</button>
                  <button onClick={() => setEditingField(null)} className="btn btn-ghost btn-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <div onClick={() => { setEditingField("preventiveAction"); setEditValue(bug.preventiveAction || ""); }}
                className="text-sm text-foreground/80 whitespace-pre-wrap cursor-pointer hover:bg-muted/30 rounded p-2 -m-2 transition-colors min-h-[50px]">
                {bug.preventiveAction || <span className="text-muted-foreground italic">Click to add preventive action...</span>}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="glass-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Reporter</span><span className="text-foreground">{bug.reportedBy?.name || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Reported</span><span className="text-foreground text-xs">{bug.reportedDate ? new Date(bug.reportedDate).toLocaleDateString() : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Release</span><span className="text-foreground">{bug.releaseVersion || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span className="text-foreground text-xs">{new Date(bug.createdAt).toLocaleDateString()}</span></div>
            </div>
          </div>

          {bug.defectLinks.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Linked Test Cases ({bug.defectLinks.length})</h3>
              <div className="space-y-2">
                {bug.defectLinks.map((dl) => (
                  <Link key={dl.testCase.id} href={`/test-cases/${dl.testCase.id}`} className="block text-xs hover:text-primary transition-colors">
                    <span className="font-mono text-muted-foreground">{dl.testCase.testCaseId}</span>
                    <p className="text-foreground line-clamp-1">{dl.testCase.testCaseTitle}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
