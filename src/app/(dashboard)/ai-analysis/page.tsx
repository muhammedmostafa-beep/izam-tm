"use client";

import { useState } from "react";
import { useFetch, apiPost } from "@/lib/api";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Brain, Zap, AlertTriangle, CheckCircle2, TrendingUp,
  ChevronDown, ChevronRight, TestTube2, Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Analysis {
  id: string;
  happyCoveragePct: number | null;
  negativeCoveragePct: number | null;
  edgeCoveragePct: number | null;
  suggestedTestCases: { title: string; scenario: string; reason: string }[] | null;
  gapsDetected: { type: string; message: string }[] | null;
  createdAt: string;
  story: { id: string; storyId: string; storyTitle: string };
  triggeredBy: { id: string; name: string; avatarUrl: string | null } | null;
}

interface StoryOption {
  id: string; storyId: string; storyTitle: string;
}

export default function AiAnalysisPage() {
  const { data: analyses, loading, refetch } = useFetch<Analysis[]>("/api/ai/analyses");
  const { data: storiesData } = useFetch<{ data: StoryOption[] }>("/api/stories");
  const [selectedStory, setSelectedStory] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const stories = storiesData?.data || [];

  const handleAnalyze = async () => {
    if (!selectedStory) return;
    setAnalyzing(true);
    try {
      await apiPost("/api/ai/analyses", { storyId: selectedStory });
      refetch();
    } catch (err) { console.error(err); }
    finally { setAnalyzing(false); }
  };

  const getCoverageColor = (pct: number | null) => {
    if (pct === null) return "text-muted-foreground";
    if (pct >= 80) return "text-success";
    if (pct >= 50) return "text-warning";
    return "text-destructive";
  };

  const getCoverageBar = (pct: number | null) => {
    const val = pct ?? 0;
    let bg = "bg-destructive";
    if (val >= 80) bg = "bg-success";
    else if (val >= 50) bg = "bg-warning";
    return (
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", bg)} style={{ width: `${Math.min(100, val)}%` }} />
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Coverage Analysis</h1>
          <p className="text-sm text-muted-foreground mt-1">Analyze test coverage gaps with AI-powered insights</p>
        </div>
      </div>

      {/* Analyze Section */}
      <div className="glass-card p-5">
        <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <Zap size={16} className="text-primary" /> Run Analysis
        </h2>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs text-muted-foreground mb-1.5">Select User Story</label>
            <select value={selectedStory} onChange={(e) => setSelectedStory(e.target.value)} className="input h-9 text-sm">
              <option value="">Choose a story...</option>
              {stories.map((s) => <option key={s.id} value={s.id}>{s.storyId} — {s.storyTitle}</option>)}
            </select>
          </div>
          <button onClick={handleAnalyze} disabled={!selectedStory || analyzing}
            className="btn btn-primary disabled:opacity-50 shrink-0">
            <Brain size={16} /> {analyzing ? "Analyzing..." : "Analyze Coverage"}
          </button>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
      ) : !analyses || analyses.length === 0 ? (
        <EmptyState icon={<Brain size={24} className="text-muted-foreground" />}
          title="No analyses yet" description="Select a story and run an analysis to see coverage insights." />
      ) : (
        <div className="space-y-3">
          {analyses.map((a) => {
            const isExpanded = expandedId === a.id;
            const avgCoverage = Math.round(
              ((a.happyCoveragePct || 0) + (a.negativeCoveragePct || 0) + (a.edgeCoveragePct || 0)) / 3
            );
            const gapCount = a.gapsDetected?.length || 0;
            const suggestionCount = a.suggestedTestCases?.length || 0;

            return (
              <div key={a.id} className="glass-card overflow-hidden">
                <button onClick={() => setExpandedId(isExpanded ? null : a.id)}
                  className="flex items-center gap-4 w-full px-5 py-4 text-left hover:bg-muted/10 transition-colors">
                  {isExpanded ? <ChevronDown size={16} className="text-muted-foreground shrink-0" /> : <ChevronRight size={16} className="text-muted-foreground shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">{a.story.storyId}</span>
                      <span className="text-sm font-medium text-foreground truncate">{a.story.storyTitle}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {a.triggeredBy?.name || "System"} · {new Date(a.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-center">
                      <p className={cn("text-lg font-bold", getCoverageColor(avgCoverage))}>{avgCoverage}%</p>
                      <p className="text-[10px] text-muted-foreground">Avg Coverage</p>
                    </div>
                    {gapCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-warning/10 text-warning">
                        <AlertTriangle size={10} /> {gapCount} gaps
                      </span>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-5 py-4 space-y-5">
                    {/* Coverage Bars */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        { label: "Happy Path", value: a.happyCoveragePct },
                        { label: "Negative", value: a.negativeCoveragePct },
                        { label: "Edge Case", value: a.edgeCoveragePct },
                      ].map((c) => (
                        <div key={c.label} className="space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">{c.label}</span>
                            <span className={cn("text-xs font-semibold", getCoverageColor(c.value))}>{Math.round(c.value || 0)}%</span>
                          </div>
                          {getCoverageBar(c.value)}
                        </div>
                      ))}
                    </div>

                    {/* Gaps */}
                    {a.gapsDetected && a.gapsDetected.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                          <AlertTriangle size={14} className="text-warning" /> Gaps Detected
                        </h4>
                        <div className="space-y-2">
                          {a.gapsDetected.map((gap, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm bg-warning/5 rounded-lg p-3">
                              <StatusBadge value={gap.type} />
                              <span className="text-foreground/80">{gap.message}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggestions */}
                    {a.suggestedTestCases && a.suggestedTestCases.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                          <Lightbulb size={14} className="text-primary" /> Suggested Test Cases
                        </h4>
                        <div className="space-y-2">
                          {a.suggestedTestCases.map((tc, i) => (
                            <div key={i} className="flex items-start gap-3 text-sm bg-primary/5 rounded-lg p-3">
                              <TestTube2 size={14} className="text-primary shrink-0 mt-0.5" />
                              <div>
                                <p className="text-foreground font-medium">{tc.title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{tc.reason}</p>
                              </div>
                              <StatusBadge value={tc.scenario} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
