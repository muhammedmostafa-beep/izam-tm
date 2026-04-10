"use client";

import { useFetch } from "@/lib/api";
import { EmptyState } from "@/components/ui/empty-state";
import { BarChart3, TrendingUp, Bug, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoverageItem {
  epicId: string; epicTitle: string;
  totalStories: number; storiesWithCoverage: number; totalTestCases: number;
  happyCoveragePct: number; negativeCoveragePct: number; edgeCoveragePct: number;
  overallCoveragePct: number; openBugs: number; closedBugs: number; passRate: number;
}
interface CoverageData {
  summary: CoverageItem[];
  totals: { totalEpics: number; totalStories: number; totalTestCases: number; overallCoverage: number; totalOpenBugs: number; avgPassRate: number };
}

function CoverageBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(value, 100)}%`, background: color }} />
      </div>
      <span className="text-xs font-medium text-foreground w-10 text-right">{value}%</span>
    </div>
  );
}

function RiskCell({ coverage, risk }: { coverage: string; risk: string }) {
  const level = coverage === "high" && risk === "high" ? "critical"
    : coverage === "high" && risk === "medium" ? "high"
    : coverage === "medium" && risk === "high" ? "critical"
    : coverage === "low" ? "critical"
    : coverage === "medium" ? "high"
    : "low";

  const colors = { critical: "bg-red-500/20 text-red-600", high: "bg-orange-500/20 text-orange-600", medium: "bg-yellow-500/20 text-yellow-600", low: "bg-green-500/20 text-green-600" };
  return <span className={cn("inline-block w-8 h-8 rounded-md text-[10px] font-semibold flex items-center justify-center", colors[level])}>{level[0].toUpperCase()}</span>;
}

export default function CoveragePage() {
  const { data, loading } = useFetch<CoverageData>("/api/coverage");

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="skeleton h-8 w-64" />
        <div className="grid grid-cols-3 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
        <div className="skeleton h-96 rounded-xl" />
      </div>
    );
  }

  if (!data || data.summary.length === 0) {
    return <EmptyState icon={<BarChart3 size={24} className="text-muted-foreground" />}
      title="No Coverage Data" description="Add epics and test cases to see coverage metrics." />;
  }

  const { totals } = data;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Coverage Summary</h1>
        <p className="text-sm text-muted-foreground mt-1">Auto-calculated coverage metrics across all epics</p>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Epics", value: totals.totalEpics, icon: BarChart3, color: "var(--izam-primary)" },
          { label: "Stories", value: totals.totalStories, icon: BarChart3, color: "199 89% 48%" },
          { label: "Test Cases", value: totals.totalTestCases, icon: CheckCircle2, color: "142 71% 45%" },
          { label: "Coverage", value: `${totals.overallCoverage}%`, icon: TrendingUp, color: "262 83% 58%" },
          { label: "Open Bugs", value: totals.totalOpenBugs, icon: Bug, color: "0 84% 60%" },
          { label: "Pass Rate", value: `${totals.avgPassRate}%`, icon: CheckCircle2, color: "142 71% 45%" },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="glass-card kpi-card text-center">
              <Icon size={18} className="mx-auto mb-1" style={{ color: `hsl(${kpi.color})` }} />
              <p className="text-xl font-bold text-foreground">{kpi.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      {/* Per-Epic Coverage Table */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Coverage by Epic</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Epic</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Stories</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">With TCs</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Total TCs</th>
                <th className="px-4 py-3 font-medium text-muted-foreground min-w-[140px]">Happy %</th>
                <th className="px-4 py-3 font-medium text-muted-foreground min-w-[140px]">Negative %</th>
                <th className="px-4 py-3 font-medium text-muted-foreground min-w-[140px]">Edge %</th>
                <th className="px-4 py-3 font-medium text-muted-foreground min-w-[140px]">Overall %</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Open Bugs</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Pass Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.summary.map((item) => (
                <tr key={item.epicId} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-muted-foreground block">{item.epicId}</span>
                    <span className="font-medium text-foreground text-sm">{item.epicTitle}</span>
                  </td>
                  <td className="px-4 py-3 text-center">{item.totalStories}</td>
                  <td className="px-4 py-3 text-center">{item.storiesWithCoverage}</td>
                  <td className="px-4 py-3 text-center font-medium">{item.totalTestCases}</td>
                  <td className="px-4 py-3"><CoverageBar value={item.happyCoveragePct} color="#22C55E" /></td>
                  <td className="px-4 py-3"><CoverageBar value={item.negativeCoveragePct} color="#EF4444" /></td>
                  <td className="px-4 py-3"><CoverageBar value={item.edgeCoveragePct} color="#F59E0B" /></td>
                  <td className="px-4 py-3"><CoverageBar value={item.overallCoveragePct}
                    color={item.overallCoveragePct >= 80 ? "#22C55E" : item.overallCoveragePct >= 50 ? "#F59E0B" : "#EF4444"} /></td>
                  <td className="px-4 py-3 text-center">
                    {item.openBugs > 0 ? (
                      <span className="inline-flex items-center gap-1 text-destructive font-medium">
                        <AlertTriangle size={12} /> {item.openBugs}
                      </span>
                    ) : <span className="text-muted-foreground">0</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn("font-medium", item.passRate >= 80 ? "text-green-600" : item.passRate >= 50 ? "text-yellow-600" : "text-red-600")}>
                      {item.passRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Risk Heat Map */}
      <div className="glass-card p-5">
        <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          <AlertTriangle size={16} className="text-warning" /> Risk Heat Map
        </h2>
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="px-3 py-2" />
                <th className="px-3 py-2 text-center text-muted-foreground">Low Risk</th>
                <th className="px-3 py-2 text-center text-muted-foreground">Medium Risk</th>
                <th className="px-3 py-2 text-center text-muted-foreground">High Risk</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Fully Covered", coverage: "high" },
                { label: "Partially Covered", coverage: "medium" },
                { label: "Not Covered", coverage: "low" },
              ].map((row) => (
                <tr key={row.label}>
                  <td className="px-3 py-2 font-medium text-muted-foreground">{row.label}</td>
                  {["low", "medium", "high"].map((risk) => (
                    <td key={risk} className="px-3 py-2 text-center">
                      <RiskCell coverage={row.coverage} risk={risk} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
