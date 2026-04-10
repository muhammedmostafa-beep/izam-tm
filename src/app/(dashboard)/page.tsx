"use client";

import {
  FileText,
  TestTube2,
  Bug,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
} from "lucide-react";

const kpiCards = [
  {
    label: "Total Stories",
    value: "0",
    change: "-",
    icon: FileText,
    color: "var(--izam-primary)",
  },
  {
    label: "Test Cases",
    value: "0",
    change: "-",
    icon: TestTube2,
    color: "142 71% 45%",
  },
  {
    label: "Open Bugs",
    value: "0",
    change: "-",
    icon: Bug,
    color: "0 84% 60%",
  },
  {
    label: "Coverage",
    value: "—",
    change: "-",
    icon: TrendingUp,
    color: "262 83% 58%",
  },
];

const quickActions = [
  {
    label: "Create Epic",
    description: "Add a new epic to the traceability matrix",
    icon: FileText,
    href: "/epics/new",
    color: "primary",
  },
  {
    label: "Add Test Case",
    description: "Create a new test case linked to a story",
    icon: TestTube2,
    href: "/test-cases/new",
    color: "success",
  },
  {
    label: "Report Bug",
    description: "Log a new production bug",
    icon: Bug,
    href: "/bugs/new",
    color: "destructive",
  },
  {
    label: "Run AI Analysis",
    description: "Analyze test coverage gaps with AI",
    icon: TrendingUp,
    href: "/ai-analysis",
    color: "accent",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome to izam Traceability Matrix. Here&apos;s your quality overview.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="glass-card kpi-card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {kpi.label}
                  </p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {kpi.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {kpi.change}
                  </p>
                </div>
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-lg"
                  style={{
                    background: `hsl(${kpi.color} / 0.1)`,
                    color: `hsl(${kpi.color})`,
                  }}
                >
                  <Icon size={20} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-2">
          <div className="glass-card p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    className="flex items-start gap-3 p-4 rounded-xl border border-border bg-background-secondary hover:border-primary/20 hover:shadow-sm transition-all duration-150 text-left group"
                  >
                    <div
                      className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 bg-${action.color}/10 text-${action.color}`}
                      style={{
                        background:
                          action.color === "primary"
                            ? "hsl(var(--izam-primary) / 0.1)"
                            : action.color === "success"
                            ? "hsl(var(--success) / 0.1)"
                            : action.color === "destructive"
                            ? "hsl(var(--destructive) / 0.1)"
                            : "hsl(var(--izam-accent) / 0.1)",
                        color:
                          action.color === "primary"
                            ? "hsl(var(--izam-primary))"
                            : action.color === "success"
                            ? "hsl(var(--success))"
                            : action.color === "destructive"
                            ? "hsl(var(--destructive))"
                            : "hsl(var(--izam-accent))",
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
                        {action.label}
                        <ArrowUpRight
                          size={12}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {action.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <div className="glass-card p-6">
            <h2 className="text-base font-semibold text-foreground mb-4">
              Recent Activity
            </h2>
            <div className="space-y-4">
              {/* Empty state */}
              <div className="text-center py-8">
                <Clock
                  size={28}
                  className="mx-auto mb-2 text-muted-foreground/50"
                />
                <p className="text-sm text-muted-foreground">
                  No activity yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Activity will appear here once you start working
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Coverage & Risk Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coverage Summary */}
        <div className="glass-card p-6">
          <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-success" />
            Coverage Summary
          </h2>
          <div className="text-center py-10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-3">
              <span className="text-2xl font-bold text-muted-foreground">
                —
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Import data to see coverage metrics
            </p>
          </div>
        </div>

        {/* Risk Heat Map */}
        <div className="glass-card p-6">
          <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle size={16} className="text-warning" />
            Risk Heat Map
          </h2>
          <div className="text-center py-10">
            <div className="grid grid-cols-3 gap-1 w-32 mx-auto mb-4">
              {[...Array(9)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-sm bg-muted"
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Risk data will populate as stories are added
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
