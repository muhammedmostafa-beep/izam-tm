"use client";

import { useState, Fragment } from "react";
import { useFetch, apiPost, apiPatch } from "@/lib/api";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Shield, Plus, Users, Pencil, Save, X, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RoleData {
  id: string; name: string;
  permissions: Record<string, boolean>;
  _count: { users: number };
  createdAt: string;
}

const PERMISSION_GROUPS = [
  {
    label: "Core Entities",
    permissions: [
      { key: "epics.create", label: "Create Epics" },
      { key: "epics.edit", label: "Edit Epics" },
      { key: "epics.delete", label: "Delete Epics" },
      { key: "stories.create", label: "Create Stories" },
      { key: "stories.edit", label: "Edit Stories" },
      { key: "stories.delete", label: "Delete Stories" },
      { key: "test_cases.create", label: "Create TCs" },
      { key: "test_cases.edit", label: "Edit TCs" },
      { key: "test_cases.delete", label: "Delete TCs" },
      { key: "bugs.create", label: "Report Bugs" },
      { key: "bugs.edit", label: "Edit Bugs" },
      { key: "bugs.delete", label: "Delete Bugs" },
    ],
  },
  {
    label: "Administration",
    permissions: [
      { key: "admin.users", label: "Manage Users" },
      { key: "admin.roles", label: "Manage Roles" },
      { key: "admin.lookups", label: "Manage Lookups" },
      { key: "admin.fields", label: "Field Config" },
      { key: "admin.approvals", label: "Review Approvals" },
      { key: "admin.jira", label: "Jira Config" },
      { key: "admin.import_export", label: "Import / Export" },
    ],
  },
  {
    label: "Analytics",
    permissions: [
      { key: "reports.view", label: "View Reports" },
      { key: "reports.create", label: "Create Reports" },
      { key: "ai.analyze", label: "Run AI Analysis" },
      { key: "matrix.view", label: "View Matrix" },
    ],
  },
];

export default function RolesAdminPage() {
  const { data: roles, loading, refetch } = useFetch<RoleData[]>("/api/admin/roles");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleCreate = async () => {
    if (!newRoleName.trim()) return;
    setCreating(true);
    try {
      const defaultPerms: Record<string, boolean> = {};
      PERMISSION_GROUPS.forEach((g) => g.permissions.forEach((p) => { defaultPerms[p.key] = false; }));
      await apiPost("/api/admin/roles", { name: newRoleName.trim(), permissions: defaultPerms });
      setNewRoleName(""); setShowCreateModal(false); refetch();
    } catch (err) { console.error(err); }
    finally { setCreating(false); }
  };

  const handleUpdateName = async (id: string) => {
    try {
      await apiPatch("/api/admin/roles", { id, name: editName.trim() });
      setEditingId(null); refetch();
    } catch (err) { console.error(err); }
  };

  const handleTogglePermission = async (role: RoleData, permKey: string) => {
    try {
      const newPerms = { ...role.permissions, [permKey]: !role.permissions[permKey] };
      await apiPatch("/api/admin/roles", { id: role.id, permissions: newPerms });
      refetch();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Roles & Permissions</h1>
          <p className="text-sm text-muted-foreground mt-1">{roles?.length || 0} roles defined</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
          <Plus size={16} /> New Role
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
      ) : !roles || roles.length === 0 ? (
        <EmptyState icon={<Shield size={24} className="text-muted-foreground" />}
          title="No roles defined" description="Create roles to control user permissions."
          action={<button onClick={() => setShowCreateModal(true)} className="btn btn-primary"><Plus size={16} />Create Role</button>} />
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground min-w-[180px] sticky left-0 bg-muted/50 z-10">
                    Permission
                  </th>
                  {roles.map((role) => (
                    <th key={role.id} className="px-4 py-3 text-center min-w-[120px]">
                      <div className="flex flex-col items-center gap-1">
                        {editingId === role.id ? (
                          <div className="flex items-center gap-1">
                            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                              className="input h-6 text-xs text-center w-24" autoFocus
                              onKeyDown={(e) => { if (e.key === "Enter") handleUpdateName(role.id); if (e.key === "Escape") setEditingId(null); }} />
                            <button onClick={() => handleUpdateName(role.id)} className="btn-icon btn-ghost w-5 h-5"><Save size={10} /></button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditingId(role.id); setEditName(role.name); }}
                            className="text-sm font-semibold text-foreground hover:text-primary flex items-center gap-1">
                            {role.name} <Pencil size={10} className="opacity-50" />
                          </button>
                        )}
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Users size={9} /> {role._count.users}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_GROUPS.map((group) => (
                  <Fragment key={group.label}>
                    <tr>
                      <td colSpan={1 + (roles?.length || 0)}
                        className="px-4 py-2 bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground sticky left-0">
                        {group.label}
                      </td>
                    </tr>
                    {group.permissions.map((perm) => (
                      <tr key={perm.key} className="border-b border-border/50 last:border-0 hover:bg-muted/10">
                        <td className="px-4 py-2 text-sm text-foreground sticky left-0 bg-card z-10">
                          {perm.label}
                        </td>
                        {roles.map((role) => (
                          <td key={role.id} className="px-4 py-2 text-center">
                            <button onClick={() => handleTogglePermission(role, perm.key)}
                              className={cn("w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all mx-auto",
                                role.permissions[perm.key]
                                  ? "bg-primary border-primary text-white"
                                  : "border-border hover:border-primary/50")}>
                              {role.permissions[perm.key] && <Check size={12} />}
                            </button>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={showCreateModal} onClose={() => { setShowCreateModal(false); setNewRoleName(""); }}
        title="Create Role" description="Define a new role with specific permissions">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Role Name <span className="text-destructive">*</span></label>
            <input type="text" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="e.g., QC Lead" className="input" autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { setShowCreateModal(false); setNewRoleName(""); }} className="btn btn-outline">Cancel</button>
            <button onClick={handleCreate} disabled={!newRoleName.trim() || creating} className="btn btn-primary disabled:opacity-50">
              {creating ? "Creating..." : "Create Role"}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
