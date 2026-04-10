"use client";

import { use, useState } from "react";
import { useFetch, apiPatch, apiDelete } from "@/lib/api";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ChevronRight, Save, X, Pencil, Trash2, TestTube2, Bug,
} from "lucide-react";

interface TCDetail {
  id: string; testCaseId: string; testCaseTitle: string;
  testLevel: string | null; testType: string | null;
  scenarioClassification: string | null; priority: string | null;
  automationStatus: string | null; executionStatus: string | null;
  requirementCoverage: string | null; requirementRef: string | null;
  testDataReference: string | null; executionCycle: string | null;
  comments: string | null; customFields: Record<string, unknown>;
  story: { id: string; storyId: string; storyTitle: string; epic: { id: string; epicId: string; epicTitle: string } | null } | null;
  storySection: { id: string; sectionTitle: string } | null;
  reviewer: { id: string; name: string; email: string; avatarUrl: string | null } | null;
  defectLinks: { bug: { id: string; bugId: string; bugTitle: string; severity: string | null; bugStatus: string | null } }[];
  createdAt: string; updatedAt: string;
}

const LOOKUP_OPTIONS: Record<string, string[]> = {
  testLevel: ["API", "UI", "Integration", "E2E"],
  testType: ["Functional", "Regression", "Integration", "UAT Support"],
  scenarioClassification: ["Happy", "Negative", "Edge"],
  priority: ["Critical", "High", "Medium", "Low"],
  automationStatus: ["Automated", "Manual", "Planned", "N/A"],
  executionStatus: ["Not Run", "Passed", "Failed", "Blocked"],
  requirementCoverage: ["Fully Covered", "Partially Covered", "Not Covered"],
};

export default function TCDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: tc, loading, refetch } = useFetch<TCDetail>(`/api/test-cases/${id}`);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleSave = async (field: string, value: string) => {
    try {
      await apiPatch(`/api/test-cases/${id}`, { [field]: value || null });
      setEditingField(null);
      refetch();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this test case?")) return;
    try { await apiDelete(`/api/test-cases/${id}`); router.push("/test-cases"); }
    catch (err) { console.error(err); }
  };

  if (loading) return <div className="space-y-4 animate-fade-in"><div className="skeleton h-8 w-48" /><div className="skeleton h-6 w-96" /><div className="skeleton h-64 rounded-xl mt-6" /></div>;
  if (!tc) return <EmptyState icon={<TestTube2 size={24} className="text-muted-foreground" />} title="Test case not found" description="This test case doesn't exist." action={<Link href="/test-cases" className="btn btn-primary">Back to Test Cases</Link>} />;

  const fields = [
    { key: "testLevel", label: "Test Level", value: tc.testLevel },
    { key: "testType", label: "Test Type", value: tc.testType },
    { key: "scenarioClassification", label: "Scenario", value: tc.scenarioClassification },
    { key: "priority", label: "Priority", value: tc.priority },
    { key: "automationStatus", label: "Automation", value: tc.automationStatus },
    { key: "executionStatus", label: "Execution", value: tc.executionStatus },
    { key: "requirementCoverage", label: "Req. Coverage", value: tc.requirementCoverage },
    { key: "requirementRef", label: "Requirement Ref", value: tc.requirementRef },
    { key: "testDataReference", label: "Test Data Ref", value: tc.testDataReference },
    { key: "executionCycle", label: "Exec. Cycle", value: tc.executionCycle },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/test-cases" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"><ArrowLeft size={14} /> Test Cases</Link>
        <ChevronRight size={14} className="text-muted-foreground" />
        <span className="text-foreground font-medium">{tc.testCaseId}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-mono text-muted-foreground mb-1">{tc.testCaseId}</p>
          <h1 className="text-2xl font-bold text-foreground">{tc.testCaseTitle}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <StatusBadge value={tc.executionStatus} size="md" />
            <StatusBadge value={tc.scenarioClassification} size="md" />
            <StatusBadge value={tc.automationStatus} size="md" />
          </div>
        </div>
        <button onClick={handleDelete} className="btn btn-destructive btn-sm"><Trash2 size={14} /> Delete</button>
      </div>

      {/* Linked Story */}
      {tc.story && (
        <div className="glass-card p-4 flex items-center gap-4">
          <div className="text-xs text-muted-foreground">Linked to:</div>
          <Link href={`/stories/${tc.story.id}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors">
            {tc.story.storyId} — {tc.story.storyTitle}
          </Link>
          {tc.story.epic && (
            <Link href={`/epics/${tc.story.epic.id}`} className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground hover:text-primary">
              {tc.story.epic.epicId}
            </Link>
          )}
          {tc.storySection && <span className="text-xs text-muted-foreground">§ {tc.storySection.sectionTitle}</span>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fields */}
        <div className="lg:col-span-2">
          <div className="glass-card p-5">
            <h2 className="text-base font-semibold text-foreground mb-4">Attributes</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fields.map((f) => (
                <div key={f.key} className="group">
                  <p className="text-xs text-muted-foreground mb-1">{f.label}</p>
                  {editingField === f.key ? (
                    <div className="flex items-center gap-1">
                      {LOOKUP_OPTIONS[f.key] ? (
                        <select value={editValue} onChange={(e) => setEditValue(e.target.value)}
                          className="input h-8 text-sm flex-1" autoFocus>
                          <option value="">— None —</option>
                          {LOOKUP_OPTIONS[f.key].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                          className="input h-8 text-sm flex-1" autoFocus
                          onKeyDown={(e) => { if (e.key === "Enter") handleSave(f.key, editValue); if (e.key === "Escape") setEditingField(null); }} />
                      )}
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

          {/* Comments */}
          <div className="glass-card p-5 mt-6">
            <h2 className="text-base font-semibold text-foreground mb-2">Comments</h2>
            {editingField === "comments" ? (
              <div className="space-y-2">
                <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)}
                  className="input min-h-[120px] text-sm" autoFocus />
                <div className="flex gap-2">
                  <button onClick={() => handleSave("comments", editValue)} className="btn btn-primary btn-sm"><Save size={12} /> Save</button>
                  <button onClick={() => setEditingField(null)} className="btn btn-ghost btn-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <div onClick={() => { setEditingField("comments"); setEditValue(tc.comments || ""); }}
                className="text-sm text-foreground/80 whitespace-pre-wrap cursor-pointer hover:bg-muted/30 rounded p-2 -m-2 transition-colors min-h-[60px]">
                {tc.comments || <span className="text-muted-foreground italic">Click to add comments...</span>}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="glass-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Reviewer</span><span className="text-foreground">{tc.reviewer?.name || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span className="text-foreground text-xs">{new Date(tc.createdAt).toLocaleDateString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Updated</span><span className="text-foreground text-xs">{new Date(tc.updatedAt).toLocaleDateString()}</span></div>
            </div>
          </div>

          {/* Defect Links */}
          {tc.defectLinks.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Linked Bugs ({tc.defectLinks.length})</h3>
              <div className="space-y-2">
                {tc.defectLinks.map((dl) => (
                  <div key={dl.bug.id} className="flex items-center justify-between">
                    <div><span className="font-mono text-xs text-muted-foreground block">{dl.bug.bugId}</span>
                      <p className="text-xs text-foreground line-clamp-1">{dl.bug.bugTitle}</p></div>
                    <StatusBadge value={dl.bug.severity} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
