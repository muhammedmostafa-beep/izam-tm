"use client";

import { useFetch } from "@/lib/api";
import {
  BarChart3, FileText, ListChecks, TestTube2, Bug, Users,
  CheckCircle2, XCircle, Clock, AlertTriangle, Cpu, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportSummary {
  totals: { epics: number; stories: number; testCases: number; bugs: number; users: number };
  execution: { passed: number; failed: number; notRun: number; blocked: number; total: number };
  severity: { critical: number; high: number; open: number; closed: number; total: number };
  scenarios: { happy: number; negative: number; edge: number; total: number };
  automation: { automated: number; manual: number; total: number };
  recentActivity: number;
}

export default function ReportsPage() {
  const { data, loading } = useFetch<ReportSummary>("/api/reports/summary");

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="skeleton h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-64 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { totals, execution, severity, scenarios, automation, recentActivity } = data;

  const executionRate = execution.total > 0 ? Math.round(((execution.passed + execution.failed) / execution.total) * 100) : 0;
  const passRate = (execution.passed + execution.failed) > 0 ? Math.round((execution.passed / (execution.passed + execution.failed)) * 100) : 0;
  const automationRate = automation.total > 0 ? Math.round((automation.automated / automation.total) * 100) : 0;
  const bugCloseRate = severity.total > 0 ? Math.round((severity.closed / severity.total) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports & Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">System-wide metrics and quality indicators</p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Epics", value: totals.epics, icon: FileText, color: "text-primary" },
          { label: "Stories", value: totals.stories, icon: ListChecks, color: "text-indigo-500" },
          { label: "Test Cases", value: totals.testCases, icon: TestTube2, color: "text-emerald-500" },
          { label: "Bugs", value: totals.bugs, icon: Bug, color: "text-red-500" },
          { label: "Active Users", value: totals.users, icon: Users, color: "text-amber-500" },
        ].map((kpi) => (
          <div key={kpi.label} className="glass-card p-4 text-center">
            <kpi.icon size={20} className={cn("mx-auto mb-1", kpi.color)} />
            <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Rate Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Execution Rate", value: executionRate, suffix: "%", icon: Activity, color: executionRate >= 70 ? "text-success" : "text-warning" },
          { label: "Pass Rate", value: passRate, suffix: "%", icon: CheckCircle2, color: passRate >= 80 ? "text-success" : passRate >= 50 ? "text-warning" : "text-destructive" },
          { label: "Automation", value: automationRate, suffix: "%", icon: Cpu, color: automationRate >= 50 ? "text-success" : "text-warning" },
          { label: "Bug Close Rate", value: bugCloseRate, suffix: "%", icon: Bug, color: bugCloseRate >= 70 ? "text-success" : "text-warning" },
        ].map((card) => (
          <div key={card.label} className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{card.label}</span>
              <card.icon size={14} className={card.color} />
            </div>
            <p className={cn("text-2xl font-bold", card.color)}>{card.value}{card.suffix}</p>
            <div className="w-full h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
              <div className={cn("h-full rounded-full transition-all",
                card.color === "text-success" ? "bg-success" : card.color === "text-warning" ? "bg-warning" : "bg-destructive")}
                style={{ width: `${card.value}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Execution Breakdown */}
        <div className="glass-card p-5">
          <h3 className="text-base font-semibold text-foreground mb-4">Execution Breakdown</h3>
          <div className="space-y-3">
            {[
              { label: "Passed", value: execution.passed, color: "bg-success", icon: CheckCircle2 },
              { label: "Failed", value: execution.failed, color: "bg-destructive", icon: XCircle },
              { label: "Not Run", value: execution.notRun, color: "bg-muted-foreground", icon: Clock },
              { label: "Blocked", value: execution.blocked, color: "bg-warning", icon: AlertTriangle },
            ].map((item) => {
              const pct = execution.total > 0 ? Math.round((item.value / execution.total) * 100) : 0;
              return (
                <div key={item.label} className="flex items-center gap-3">
                  <item.icon size={14} className="text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground w-20">{item.label}</span>
                  <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", item.color)} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-medium text-foreground w-12 text-right">{item.value} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scenario Distribution */}
        <div className="glass-card p-5">
          <h3 className="text-base font-semibold text-foreground mb-4">Scenario Distribution</h3>
          <div className="flex items-center justify-center gap-6 py-4">
            {[
              { label: "Happy", value: scenarios.happy, color: "#22C55E" },
              { label: "Negative", value: scenarios.negative, color: "#EF4444" },
              { label: "Edge", value: scenarios.edge, color: "#F59E0B" },
            ].map((s) => {
              const pct = scenarios.total > 0 ? Math.round((s.value / scenarios.total) * 100) : 0;
              return (
                <div key={s.label} className="text-center">
                  <div className="relative w-20 h-20 mx-auto mb-2">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted" />
                      <circle cx="18" cy="18" r="14" fill="none" stroke={s.color} strokeWidth="3"
                        strokeDasharray={`${pct * 0.88} 100`} strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">{pct}%</span>
                  </div>
                  <p className="text-xs font-medium text-foreground">{s.label}</p>
                  <p className="text-[10px] text-muted-foreground">{s.value} TCs</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bug Severity */}
        <div className="glass-card p-5">
          <h3 className="text-base font-semibold text-foreground mb-4">Bug Severity</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Critical", value: severity.critical, color: "text-red-600 bg-red-50 dark:bg-red-500/10" },
              { label: "High", value: severity.high, color: "text-orange-500 bg-orange-50 dark:bg-orange-500/10" },
              { label: "Open", value: severity.open, color: "text-blue-500 bg-blue-50 dark:bg-blue-500/10" },
              { label: "Closed", value: severity.closed, color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" },
            ].map((b) => (
              <div key={b.label} className={cn("rounded-lg p-3 text-center", b.color.split(" ").slice(1).join(" "))}>
                <p className={cn("text-2xl font-bold", b.color.split(" ")[0])}>{b.value}</p>
                <p className="text-xs text-muted-foreground">{b.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="glass-card p-5">
          <h3 className="text-base font-semibold text-foreground mb-4">Quick Stats</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Automated TCs</span>
              <span className="text-sm font-semibold text-foreground">{automation.automated} / {automation.total}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Manual TCs</span>
              <span className="text-sm font-semibold text-foreground">{automation.manual}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Recent Activity (7d)</span>
              <span className="text-sm font-semibold text-foreground">{recentActivity} events</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-muted-foreground">Avg TCs per Story</span>
              <span className="text-sm font-semibold text-foreground">
                {totals.stories > 0 ? (totals.testCases / totals.stories).toFixed(1) : "0"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
