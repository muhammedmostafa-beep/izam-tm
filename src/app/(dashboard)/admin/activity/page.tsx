"use client";

import { useState } from "react";
import { useFetch } from "@/lib/api";
import { EmptyState } from "@/components/ui/empty-state";
import {
  History, User, FileText, ListChecks, TestTube2, Bug,
  Plus, Pencil, Trash2, Filter, ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditLog {
  id: string; entityType: string; entityId: string;
  action: string; fieldName: string | null;
  oldValue: string | null; newValue: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null } | null;
}

interface ActivityResponse {
  data: AuditLog[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const ENTITY_ICONS: Record<string, React.ElementType> = {
  epic: FileText, story: ListChecks, test_case: TestTube2, bug: Bug,
};
const ACTION_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  create: { label: "Created", icon: Plus, color: "text-success bg-success/10" },
  update: { label: "Updated", icon: Pencil, color: "text-primary bg-primary/10" },
  delete: { label: "Deleted", icon: Trash2, color: "text-destructive bg-destructive/10" },
};

export default function ActivityLogPage() {
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (entityFilter) params.set("entityType", entityFilter);
  if (actionFilter) params.set("action", actionFilter);
  params.set("page", String(page));
  params.set("limit", "30");

  const { data, loading } = useFetch<ActivityResponse>(`/api/admin/activity?${params}`);
  const logs = data?.data || [];
  const pagination = data?.pagination;

  // Group logs by date
  const grouped: Record<string, AuditLog[]> = {};
  logs.forEach((log) => {
    const date = new Date(log.createdAt).toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(log);
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Activity Log</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {pagination?.total || 0} events tracked
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={entityFilter} onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
          className="input h-9 text-sm pr-8 appearance-none cursor-pointer min-w-[130px]">
          <option value="">All Entities</option>
          <option value="epic">Epics</option>
          <option value="story">Stories</option>
          <option value="test_case">Test Cases</option>
          <option value="bug">Bugs</option>
          <option value="lookup">Lookups</option>
          <option value="user">Users</option>
        </select>
        <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="input h-9 text-sm pr-8 appearance-none cursor-pointer min-w-[120px]">
          <option value="">All Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
        </select>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="space-y-3">{[...Array(8)].map((_, i) => <div key={i} className="skeleton h-14 rounded-lg" />)}</div>
      ) : logs.length === 0 ? (
        <EmptyState icon={<History size={24} className="text-muted-foreground" />}
          title="No activity yet" description="Actions performed in the system will appear here as a timeline." />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, entries]) => (
            <div key={date}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 sticky top-0 bg-background z-10 py-1">
                {date}
              </h3>
              <div className="space-y-1">
                {entries.map((log) => {
                  const EntityIcon = ENTITY_ICONS[log.entityType] || FileText;
                  const actionCfg = ACTION_CONFIG[log.action] || ACTION_CONFIG.update;
                  const ActionIcon = actionCfg.icon;

                  return (
                    <div key={log.id} className="flex items-start gap-3 px-4 py-3 rounded-lg hover:bg-muted/20 transition-colors group">
                      {/* Timeline dot */}
                      <div className="relative flex flex-col items-center">
                        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0", actionCfg.color)}>
                          <ActionIcon size={12} />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{log.user?.name || "System"}</span>
                          <span className="text-xs text-muted-foreground">{actionCfg.label.toLowerCase()}</span>
                          <span className="inline-flex items-center gap-1 text-xs">
                            <EntityIcon size={11} className="text-muted-foreground" />
                            <span className="capitalize text-foreground">{log.entityType.replace("_", " ")}</span>
                          </span>
                          {log.fieldName && (
                            <code className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono text-muted-foreground">{log.fieldName}</code>
                          )}
                        </div>
                        {(log.oldValue || log.newValue) && (
                          <div className="flex items-center gap-2 text-xs mt-1">
                            {log.oldValue && <span className="text-destructive line-through max-w-[200px] truncate">{log.oldValue}</span>}
                            {log.oldValue && log.newValue && <span className="text-muted-foreground">→</span>}
                            {log.newValue && <span className="text-success max-w-[200px] truncate">{log.newValue}</span>}
                          </div>
                        )}
                      </div>

                      {/* Time */}
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(log.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}
                className="btn btn-outline btn-sm disabled:opacity-30">
                <ChevronLeft size={14} /> Prev
              </button>
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button onClick={() => setPage(Math.min(pagination.totalPages, page + 1))} disabled={page >= pagination.totalPages}
                className="btn btn-outline btn-sm disabled:opacity-30">
                Next <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
