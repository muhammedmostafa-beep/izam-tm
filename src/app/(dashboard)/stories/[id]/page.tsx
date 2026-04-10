"use client";

import { use, useState } from "react";
import { useFetch, apiPatch, apiPost, apiDelete } from "@/lib/api";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import {
  ArrowLeft, ChevronRight, Pencil, Save, X, Plus, Trash2, GripVertical,
  FileText, TestTube2, Bug, Layers, Calendar, User, Tag
} from "lucide-react";

interface StoryDetail {
  id: string;
  storyId: string;
  storyTitle: string;
  epicId: string | null;
  epic: { id: string; epicId: string; epicTitle: string } | null;
  owner: { id: string; name: string; email: string; avatarUrl: string | null } | null;
  requester: { id: string; name: string; email: string } | null;
  businessPriority: string | null;
  changeType: string | null;
  businessImpact: string | null;
  riskLevel: string | null;
  moduleFeature: string | null;
  implementationSprint: string | null;
  sprintStartDate: string | null;
  sprintEndDate: string | null;
  releaseVersion: string | null;
  deploymentDate: string | null;
  storyStatus: string | null;
  qcStatus: string | null;
  reasonForRequest: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  sections: { id: string; sectionTitle: string; sectionContent: string | null; sortOrder: number }[];
  testCases: {
    id: string; testCaseId: string; testCaseTitle: string;
    executionStatus: string | null; scenarioClassification: string | null;
    automationStatus: string | null; priority: string | null;
    reviewer: { id: string; name: string } | null;
    storySection: { id: string; sectionTitle: string } | null;
  }[];
  linkedBugs: { id: string; bugId: string; bugTitle: string; severity: string | null; bugStatus: string | null }[];
}

export default function StoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: story, loading, refetch } = useFetch<StoryDetail>(`/api/stories/${id}`);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionContent, setNewSectionContent] = useState("");
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editSectionTitle, setEditSectionTitle] = useState("");
  const [editSectionContent, setEditSectionContent] = useState("");

  const handleFieldSave = async (field: string, value: string) => {
    try {
      await apiPatch(`/api/stories/${id}`, { [field]: value || null });
      setEditingField(null);
      refetch();
    } catch (err) { console.error(err); }
  };

  const handleAddSection = async () => {
    if (!newSectionTitle.trim()) return;
    try {
      await apiPost(`/api/stories/${id}/sections`, {
        sectionTitle: newSectionTitle.trim(),
        sectionContent: newSectionContent.trim() || null,
      });
      setNewSectionTitle(""); setNewSectionContent(""); setShowAddSection(false);
      refetch();
    } catch (err) { console.error(err); }
  };

  const handleEditSection = async (sectionId: string) => {
    try {
      await apiPatch(`/api/stories/${id}/sections`, {
        sectionId,
        sectionTitle: editSectionTitle.trim(),
        sectionContent: editSectionContent.trim() || null,
      });
      setEditingSectionId(null);
      refetch();
    } catch (err) { console.error(err); }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm("Delete this section?")) return;
    try {
      await apiDelete(`/api/stories/${id}/sections?sectionId=${sectionId}`);
      refetch();
    } catch (err) { console.error(err); }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-6 w-96" />
        <div className="grid grid-cols-2 gap-4 mt-6">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!story) {
    return <EmptyState icon={<FileText size={24} className="text-muted-foreground" />}
      title="Story not found" description="This story doesn't exist or was deleted."
      action={<Link href="/stories" className="btn btn-primary">Back to Stories</Link>} />;
  }

  const detailFields = [
    { key: "businessPriority", label: "Business Priority", value: story.businessPriority, icon: Tag },
    { key: "changeType", label: "Change Type", value: story.changeType, icon: Tag },
    { key: "businessImpact", label: "Business Impact", value: story.businessImpact, icon: Tag },
    { key: "riskLevel", label: "Risk Level", value: story.riskLevel, icon: Tag },
    { key: "moduleFeature", label: "Module / Feature", value: story.moduleFeature, icon: Layers },
    { key: "implementationSprint", label: "Sprint", value: story.implementationSprint, icon: Calendar },
    { key: "releaseVersion", label: "Release Version", value: story.releaseVersion, icon: Tag },
    { key: "storyStatus", label: "Story Status", value: story.storyStatus, icon: Tag },
    { key: "qcStatus", label: "QC Status", value: story.qcStatus, icon: Tag },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/stories" className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft size={14} /> Stories
        </Link>
        <ChevronRight size={14} className="text-muted-foreground" />
        <span className="text-foreground font-medium">{story.storyId}</span>
      </div>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono text-muted-foreground">{story.storyId}</span>
          {story.epic && (
            <Link href={`/epics/${story.epic.id}`} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground hover:text-primary">
              {story.epic.epicId}
            </Link>
          )}
        </div>
        <h1 className="text-2xl font-bold text-foreground">{story.storyTitle}</h1>
        <div className="flex flex-wrap gap-2 mt-2">
          <StatusBadge value={story.storyStatus} size="md" />
          <StatusBadge value={story.qcStatus} size="md" />
          {story.businessPriority && <StatusBadge value={story.businessPriority} size="md" />}
          {story.riskLevel && <StatusBadge value={`Risk: ${story.riskLevel}`} size="md" />}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details Grid */}
          <div className="glass-card p-5">
            <h2 className="text-base font-semibold text-foreground mb-4">Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {detailFields.map((f) => (
                <div key={f.key} className="flex items-start gap-3 group">
                  <f.icon size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">{f.label}</p>
                    {editingField === f.key ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                          className="input h-7 text-sm flex-1" autoFocus
                          onKeyDown={(e) => { if (e.key === "Enter") handleFieldSave(f.key, editValue); if (e.key === "Escape") setEditingField(null); }} />
                        <button onClick={() => handleFieldSave(f.key, editValue)} className="btn-icon btn-ghost"><Save size={12} /></button>
                        <button onClick={() => setEditingField(null)} className="btn-icon btn-ghost"><X size={12} /></button>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground flex items-center gap-1 cursor-pointer hover:text-primary"
                        onClick={() => { setEditingField(f.key); setEditValue(f.value || ""); }}>
                        {f.value ? <StatusBadge value={f.value} /> : <span className="text-muted-foreground">—</span>}
                        <Pencil size={10} className="opacity-0 group-hover:opacity-50" />
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reason for Request */}
          {story.reasonForRequest && (
            <div className="glass-card p-5">
              <h2 className="text-base font-semibold text-foreground mb-2">Reason for Request</h2>
              <p className="text-sm text-foreground/80 whitespace-pre-wrap">{story.reasonForRequest}</p>
            </div>
          )}

          {/* Story Sections */}
          <div className="glass-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Sections ({story.sections.length})</h2>
              <button onClick={() => setShowAddSection(true)} className="btn btn-outline btn-sm"><Plus size={14} /> Add Section</button>
            </div>

            {/* Add Section Form */}
            {showAddSection && (
              <div className="px-5 py-4 border-b border-border bg-muted/20 space-y-3">
                <input type="text" value={newSectionTitle} onChange={(e) => setNewSectionTitle(e.target.value)}
                  placeholder="Section title" className="input h-9 text-sm" autoFocus />
                <textarea value={newSectionContent} onChange={(e) => setNewSectionContent(e.target.value)}
                  placeholder="Section description (optional)" className="input min-h-[60px] text-sm" />
                <div className="flex gap-2">
                  <button onClick={handleAddSection} disabled={!newSectionTitle.trim()} className="btn btn-primary btn-sm disabled:opacity-50">Add</button>
                  <button onClick={() => { setShowAddSection(false); setNewSectionTitle(""); setNewSectionContent(""); }} className="btn btn-ghost btn-sm">Cancel</button>
                </div>
              </div>
            )}

            {story.sections.length === 0 && !showAddSection ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">No sections defined. Add sections to break this story into granular parts.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {story.sections.map((section) => {
                  const sectionTCs = story.testCases.filter((tc) => tc.storySection?.id === section.id);
                  const isEditing = editingSectionId === section.id;
                  return (
                    <div key={section.id} className="px-5 py-4 group">
                      {isEditing ? (
                        <div className="space-y-2">
                          <input type="text" value={editSectionTitle} onChange={(e) => setEditSectionTitle(e.target.value)}
                            className="input h-8 text-sm" autoFocus
                            onKeyDown={(e) => { if (e.key === "Enter") handleEditSection(section.id); if (e.key === "Escape") setEditingSectionId(null); }} />
                          <textarea value={editSectionContent} onChange={(e) => setEditSectionContent(e.target.value)}
                            className="input min-h-[50px] text-sm" />
                          <div className="flex gap-2">
                            <button onClick={() => handleEditSection(section.id)} className="btn btn-primary btn-sm"><Save size={12} /> Save</button>
                            <button onClick={() => setEditingSectionId(null)} className="btn btn-ghost btn-sm">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-foreground">{section.sectionTitle}</h3>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground mr-2">{sectionTCs.length} TCs</span>
                              <button onClick={() => { setEditingSectionId(section.id); setEditSectionTitle(section.sectionTitle); setEditSectionContent(section.sectionContent || ""); }}
                                className="btn-icon btn-ghost opacity-0 group-hover:opacity-100 transition-opacity"><Pencil size={12} /></button>
                              <button onClick={() => handleDeleteSection(section.id)}
                                className="btn-icon btn-ghost text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={12} /></button>
                            </div>
                          </div>
                          {section.sectionContent && (
                            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{section.sectionContent}</p>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Test Cases */}
          <div className="glass-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Test Cases ({story.testCases.length})</h2>
            </div>
            {story.testCases.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">No test cases linked.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">TC ID</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Title</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Section</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Scenario</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Execution</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Automation</th>
                  </tr></thead>
                  <tbody>
                    {story.testCases.map((tc) => (
                      <tr key={tc.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-2.5"><Link href={`/test-cases/${tc.id}`} className="font-mono text-xs text-muted-foreground hover:text-primary">{tc.testCaseId}</Link></td>
                        <td className="px-4 py-2.5"><Link href={`/test-cases/${tc.id}`} className="font-medium text-foreground hover:text-primary transition-colors">{tc.testCaseTitle}</Link></td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{tc.storySection?.sectionTitle || "—"}</td>
                        <td className="px-4 py-2.5"><StatusBadge value={tc.scenarioClassification} /></td>
                        <td className="px-4 py-2.5"><StatusBadge value={tc.executionStatus} /></td>
                        <td className="px-4 py-2.5"><StatusBadge value={tc.automationStatus} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Meta Info */}
          <div className="glass-card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Owner</span>
                <span className="text-foreground">{story.owner?.name || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Requester</span>
                <span className="text-foreground">{story.requester?.name || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Sprint Dates</span>
                <span className="text-foreground text-xs">
                  {story.sprintStartDate ? new Date(story.sprintStartDate).toLocaleDateString() : "—"}
                  {" → "}
                  {story.sprintEndDate ? new Date(story.sprintEndDate).toLocaleDateString() : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="text-foreground text-xs">{new Date(story.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Coverage Breakdown */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Scenario Coverage</h3>
            {["Happy", "Negative", "Edge"].map((type) => {
              const count = story.testCases.filter((tc) => tc.scenarioClassification === type).length;
              return (
                <div key={type} className="flex items-center justify-between py-1.5">
                  <StatusBadge value={type} />
                  <span className="text-sm font-medium text-foreground">{count}</span>
                </div>
              );
            })}
          </div>

          {/* Linked Bugs */}
          {story.linkedBugs.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Linked Bugs ({story.linkedBugs.length})
              </h3>
              <div className="space-y-2">
                {story.linkedBugs.map((bug) => (
                  <div key={bug.id} className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs text-muted-foreground">{bug.bugId}</span>
                      <p className="text-xs text-foreground line-clamp-1">{bug.bugTitle}</p>
                    </div>
                    <StatusBadge value={bug.severity} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {story.notes && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-2">Notes</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{story.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
