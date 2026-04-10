"use client";

import { useState } from "react";
import { useFetch, apiPatch } from "@/lib/api";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import {
  Shield, Check, X, Clock, Filter, ChevronDown,
  FileText, ListChecks, TestTube2, Bug, User,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChangeRequest {
  id: string; entityType: string; entityId: string;
  changesDiff: Record<string, { old: unknown; new: unknown }>;
  status: string; reviewComment: string | null;
  submittedAt: string; reviewedAt: string | null;
  submittedBy: { id: string; name: string; email: string; avatarUrl: string | null };
  reviewedBy: { id: string; name: string; avatarUrl: string | null } | null;
}

interface ApprovalsResponse {
  data: ChangeRequest[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const ENTITY_ICONS: Record<string, React.ElementType> = {
  epic: FileText, story: ListChecks, test_case: TestTube2, bug: Bug,
};
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Pending", color: "text-warning bg-warning/10", icon: Clock },
  approved: { label: "Approved", color: "text-success bg-success/10", icon: Check },
  rejected: { label: "Rejected", color: "text-destructive bg-destructive/10", icon: X },
};

export default function ApprovalsPage() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const { data, loading, refetch } = useFetch<ApprovalsResponse>(`/api/admin/approvals?status=${statusFilter}`);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);

  const handleReview = async (id: string, status: "approved" | "rejected") => {
    try {
      await apiPatch(`/api/admin/approvals/${id}`, {
        status,
        reviewComment: reviewComment.trim() || null,
      });
      setReviewingId(null); setReviewComment(""); refetch();
    } catch (err) { console.error(err); }
  };

  const requests = data?.data || [];
  const detailRequest = requests.find((r) => r.id === detailId);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Approval Queue</h1>
          <p className="text-sm text-muted-foreground mt-1">{data?.pagination.total || 0} requests</p>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        {["pending", "approved", "rejected"].map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn("flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all",
                statusFilter === s ? "bg-background-secondary shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
              <cfg.icon size={14} /> {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Request List */}
      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
      ) : requests.length === 0 ? (
        <EmptyState icon={<Shield size={24} className="text-muted-foreground" />}
          title={`No ${statusFilter} requests`} description="Change requests will appear here when submitted." />
      ) : (
        <div className="space-y-3">
          {requests.map((cr) => {
            const EntityIcon = ENTITY_ICONS[cr.entityType] || FileText;
            const statusCfg = STATUS_CONFIG[cr.status];
            const changedFields = Object.keys(cr.changesDiff || {});

            return (
              <div key={cr.id} className="glass-card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <EntityIcon size={18} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground capitalize">{cr.entityType.replace("_", " ")}</span>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">{cr.entityId.slice(0, 8)}</code>
                        <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full", statusCfg.color)}>
                          <statusCfg.icon size={10} /> {statusCfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {changedFields.length} field{changedFields.length !== 1 ? "s" : ""} changed ·{" "}
                        <button onClick={() => setDetailId(detailId === cr.id ? null : cr.id)}
                          className="text-primary hover:underline">
                          {detailId === cr.id ? "Hide" : "View"} changes
                        </button>
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <User size={10} />
                        <span>{cr.submittedBy.name}</span>
                        <span>·</span>
                        <span>{new Date(cr.submittedAt).toLocaleString()}</span>
                      </div>
                      {cr.reviewedBy && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Reviewed by {cr.reviewedBy.name} · {cr.reviewedAt ? new Date(cr.reviewedAt).toLocaleString() : ""}
                        </p>
                      )}
                      {cr.reviewComment && (
                        <p className="text-xs text-muted-foreground mt-1 italic">&quot;{cr.reviewComment}&quot;</p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {cr.status === "pending" && (
                    <div className="flex items-center gap-2 shrink-0">
                      {reviewingId === cr.id ? (
                        <div className="flex items-center gap-2">
                          <input type="text" value={reviewComment} onChange={(e) => setReviewComment(e.target.value)}
                            placeholder="Comment (optional)" className="input h-8 text-xs w-44" />
                          <button onClick={() => handleReview(cr.id, "approved")}
                            className="btn btn-sm bg-success/10 text-success hover:bg-success/20 border-success/20">
                            <Check size={14} /> Approve
                          </button>
                          <button onClick={() => handleReview(cr.id, "rejected")}
                            className="btn btn-sm bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20">
                            <X size={14} /> Reject
                          </button>
                          <button onClick={() => { setReviewingId(null); setReviewComment(""); }}
                            className="btn btn-ghost btn-sm">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setReviewingId(cr.id)} className="btn btn-outline btn-sm">Review</button>
                      )}
                    </div>
                  )}
                </div>

                {/* Changes Detail */}
                {detailId === cr.id && cr.changesDiff && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="space-y-2">
                      {Object.entries(cr.changesDiff).map(([field, diff]) => (
                        <div key={field} className="flex items-start gap-3 text-xs">
                          <span className="font-medium text-foreground min-w-[120px]">{field}</span>
                          <span className="text-destructive line-through">{String(diff.old || "—")}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="text-success">{String(diff.new || "—")}</span>
                        </div>
                      ))}
                    </div>
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
