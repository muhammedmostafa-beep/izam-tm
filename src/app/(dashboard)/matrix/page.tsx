"use client";

import { useFetch } from "@/lib/api";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useState } from "react";
import { Layers, ChevronDown, ChevronRight, FileText, TestTube2, Bug } from "lucide-react";
import { cn } from "@/lib/utils";

interface MatrixBug { id: string; bugId: string; bugTitle: string; severity: string | null; bugStatus: string | null }
interface MatrixTC {
  id: string; testCaseId: string; testCaseTitle: string;
  executionStatus: string | null; scenarioClassification: string | null; automationStatus: string | null;
  storySection: { id: string; sectionTitle: string } | null;
  defectLinks: { bug: MatrixBug }[];
}
interface MatrixStory {
  id: string; storyId: string; storyTitle: string;
  storyStatus: string | null; qcStatus: string | null;
  testCases: MatrixTC[]; linkedBugs: MatrixBug[];
  sections: { id: string; sectionTitle: string }[];
}
interface MatrixEpic {
  id: string; epicId: string; epicTitle: string;
  userStories: MatrixStory[];
}
interface MatrixData { epics: MatrixEpic[]; orphanStories: MatrixStory[] }

export default function MatrixPage() {
  const { data, loading } = useFetch<MatrixData>("/api/matrix");
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set());
  const [expandedStories, setExpandedStories] = useState<Set<string>>(new Set());

  const toggleEpic = (id: string) => {
    const next = new Set(expandedEpics);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedEpics(next);
  };
  const toggleStory = (id: string) => {
    const next = new Set(expandedStories);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedStories(next);
  };
  const expandAll = () => {
    if (!data) return;
    const epicIds = new Set(data.epics.map((e) => e.id));
    const storyIds = new Set([
      ...data.epics.flatMap((e) => e.userStories.map((s) => s.id)),
      ...data.orphanStories.map((s) => s.id),
    ]);
    setExpandedEpics(epicIds);
    setExpandedStories(storyIds);
  };
  const collapseAll = () => { setExpandedEpics(new Set()); setExpandedStories(new Set()); };

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="skeleton h-8 w-64" />
        {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-14 w-full rounded-lg" />)}
      </div>
    );
  }

  const isEmpty = !data || (data.epics.length === 0 && data.orphanStories.length === 0);

  if (isEmpty) {
    return <EmptyState icon={<Layers size={24} className="text-muted-foreground" />}
      title="Traceability Matrix is Empty" description="Create epics and stories to see the full traceability chain." />;
  }

  const totalStories = data!.epics.reduce((s, e) => s + e.userStories.length, 0) + data!.orphanStories.length;
  const totalTCs = data!.epics.reduce((s, e) => s + e.userStories.reduce((ss, st) => ss + st.testCases.length, 0), 0)
    + data!.orphanStories.reduce((s, st) => s + st.testCases.length, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Traceability Matrix</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data!.epics.length} epics · {totalStories} stories · {totalTCs} test cases
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={expandAll} className="btn btn-outline btn-sm">Expand All</button>
          <button onClick={collapseAll} className="btn btn-outline btn-sm">Collapse All</button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><FileText size={12} className="text-primary" /> Epic</span>
        <span className="flex items-center gap-1"><FileText size={12} className="text-info" /> Story</span>
        <span className="flex items-center gap-1"><TestTube2 size={12} className="text-success" /> Test Case</span>
        <span className="flex items-center gap-1"><Bug size={12} className="text-destructive" /> Bug</span>
      </div>

      {/* Matrix Tree */}
      <div className="glass-card overflow-hidden">
        {data!.epics.map((epic) => {
          const isExpanded = expandedEpics.has(epic.id);
          const epicTCs = epic.userStories.reduce((s, st) => s + st.testCases.length, 0);
          return (
            <div key={epic.id} className="border-b border-border last:border-0">
              {/* Epic Row */}
              <button onClick={() => toggleEpic(epic.id)}
                className="flex items-center gap-3 w-full px-5 py-3.5 hover:bg-muted/30 transition-colors text-left">
                {isExpanded ? <ChevronDown size={16} className="text-muted-foreground shrink-0" /> : <ChevronRight size={16} className="text-muted-foreground shrink-0" />}
                <FileText size={16} className="text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-xs text-muted-foreground mr-2">{epic.epicId}</span>
                  <span className="font-semibold text-foreground">{epic.epicTitle}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                  <span>{epic.userStories.length} stories</span>
                  <span>{epicTCs} TCs</span>
                </div>
              </button>

              {/* Stories */}
              {isExpanded && epic.userStories.map((story) => {
                const storyExpanded = expandedStories.has(story.id);
                return (
                  <div key={story.id}>
                    <button onClick={() => toggleStory(story.id)}
                      className="flex items-center gap-3 w-full pl-12 pr-5 py-2.5 hover:bg-muted/20 transition-colors text-left border-t border-border/50">
                      {storyExpanded ? <ChevronDown size={14} className="text-muted-foreground shrink-0" /> : <ChevronRight size={14} className="text-muted-foreground shrink-0" />}
                      <FileText size={14} className="text-info shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="font-mono text-[11px] text-muted-foreground mr-2">{story.storyId}</span>
                        <span className="text-sm text-foreground">{story.storyTitle}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge value={story.storyStatus} />
                        <StatusBadge value={story.qcStatus} />
                        <span className="text-xs text-muted-foreground">{story.testCases.length} TCs</span>
                      </div>
                    </button>

                    {/* Test Cases */}
                    {storyExpanded && story.testCases.map((tc) => (
                      <div key={tc.id} className="flex items-center gap-3 pl-20 pr-5 py-2 border-t border-border/30 bg-muted/10">
                        <TestTube2 size={13} className="text-success shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="font-mono text-[11px] text-muted-foreground mr-2">{tc.testCaseId}</span>
                          <span className="text-sm text-foreground">{tc.testCaseTitle}</span>
                          {tc.storySection && (
                            <span className="text-[10px] text-muted-foreground ml-2">§ {tc.storySection.sectionTitle}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <StatusBadge value={tc.scenarioClassification} />
                          <StatusBadge value={tc.executionStatus} />
                          <StatusBadge value={tc.automationStatus} />
                        </div>
                      </div>
                    ))}

                    {/* Bugs linked to story */}
                    {storyExpanded && story.linkedBugs.map((bug) => (
                      <div key={bug.id} className="flex items-center gap-3 pl-20 pr-5 py-2 border-t border-border/30 bg-destructive/3">
                        <Bug size={13} className="text-destructive shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="font-mono text-[11px] text-muted-foreground mr-2">{bug.bugId}</span>
                          <span className="text-sm text-foreground">{bug.bugTitle}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <StatusBadge value={bug.severity} />
                          <StatusBadge value={bug.bugStatus} />
                        </div>
                      </div>
                    ))}

                    {storyExpanded && story.testCases.length === 0 && story.linkedBugs.length === 0 && (
                      <div className="pl-20 pr-5 py-2 border-t border-border/30 text-xs text-muted-foreground italic">
                        No test cases or bugs linked
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Orphan Stories */}
        {data!.orphanStories.length > 0 && (
          <div className="border-t-2 border-warning/30">
            <div className="px-5 py-3 bg-warning/5">
              <span className="text-xs font-semibold text-warning">⚠ Unlinked Stories ({data!.orphanStories.length})</span>
            </div>
            {data!.orphanStories.map((story) => {
              const storyExpanded = expandedStories.has(story.id);
              return (
                <div key={story.id} className="border-t border-border/50">
                  <button onClick={() => toggleStory(story.id)}
                    className="flex items-center gap-3 w-full pl-8 pr-5 py-2.5 hover:bg-muted/20 text-left">
                    {storyExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <FileText size={14} className="text-warning shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-[11px] text-muted-foreground mr-2">{story.storyId}</span>
                      <span className="text-sm text-foreground">{story.storyTitle}</span>
                    </div>
                    <StatusBadge value={story.storyStatus} />
                  </button>
                  {storyExpanded && story.testCases.map((tc) => (
                    <div key={tc.id} className="flex items-center gap-3 pl-16 pr-5 py-2 border-t border-border/30 bg-muted/10">
                      <TestTube2 size={13} className="text-success shrink-0" />
                      <span className="font-mono text-[11px] text-muted-foreground mr-2">{tc.testCaseId}</span>
                      <span className="text-sm text-foreground flex-1">{tc.testCaseTitle}</span>
                      <StatusBadge value={tc.executionStatus} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
