"use client";

import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  value: string | null | undefined;
  color?: string | null;
  size?: "sm" | "md";
}

// Default color mapping for common statuses
const STATUS_COLORS: Record<string, string> = {
  // Severity / Priority
  Critical: "#DC2626",
  High: "#EF4444",
  Medium: "#F59E0B",
  Low: "#22C55E",
  // Statuses
  Open: "#EF4444",
  "In Progress": "#3B82F6",
  Closed: "#22C55E",
  Done: "#22C55E",
  Deferred: "#6B7280",
  Backlog: "#6B7280",
  "Ready for Test": "#F59E0B",
  "Not Started": "#6B7280",
  Passed: "#22C55E",
  Failed: "#EF4444",
  Blocked: "#F59E0B",
  "Not Run": "#6B7280",
  // Coverage
  "Fully Covered": "#22C55E",
  "Partially Covered": "#F59E0B",
  "Not Covered": "#EF4444",
  // Scenario
  Happy: "#22C55E",
  Negative: "#EF4444",
  Edge: "#F59E0B",
  // Automation
  Automated: "#22C55E",
  Manual: "#6B7280",
  Planned: "#3B82F6",
  "N/A": "#9CA3AF",
  // Test Level
  API: "#8B5CF6",
  UI: "#3B82F6",
  Integration: "#06B6D4",
  E2E: "#10B981",
  // Boolean
  Yes: "#22C55E",
  No: "#EF4444",
};

export function StatusBadge({ value, color, size = "sm" }: StatusBadgeProps) {
  if (!value) return <span className="text-muted-foreground text-xs">—</span>;

  const badgeColor = color || STATUS_COLORS[value] || "#6B7280";

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      )}
      style={{
        background: `${badgeColor}18`,
        color: badgeColor,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full mr-1.5 shrink-0"
        style={{ background: badgeColor }}
      />
      {value}
    </span>
  );
}
