"use client";

import { useState } from "react";
import { useFetch, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Users, Plus, Search, Pencil, Save, X, Shield,
  UserCheck, UserX, Mail, Briefcase, Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UserData {
  id: string; email: string; name: string | null;
  title: string | null; avatarUrl: string | null;
  isActive: boolean; createdAt: string;
  role: { id: string; name: string; permissions: Record<string, unknown> } | null;
  _count: { ownedEpics: number; ownedStories: number; reviewedTestCases: number; reportedBugs: number };
}

interface RoleData {
  id: string; name: string; permissions: Record<string, unknown>;
  _count: { users: number };
}

export default function UsersAdminPage() {
  const { data: users, loading, refetch } = useFetch<UserData[]>("/api/admin/users");
  const { data: roles } = useFetch<RoleData[]>("/api/admin/roles");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newRoleId, setNewRoleId] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editRoleId, setEditRoleId] = useState("");

  const filtered = (users || []).filter((u) => {
    const matchSearch = !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || (statusFilter === "active" ? u.isActive : !u.isActive);
    return matchSearch && matchStatus;
  });

  const handleCreate = async () => {
    if (!newName.trim() || !newEmail.trim()) return;
    setCreating(true);
    try {
      await apiPost("/api/admin/users", { name: newName.trim(), email: newEmail.trim(), title: newTitle.trim() || null, roleId: newRoleId || null });
      setNewName(""); setNewEmail(""); setNewTitle(""); setNewRoleId(""); setShowCreateModal(false);
      refetch();
    } catch (err) { console.error(err); }
    finally { setCreating(false); }
  };

  const handleUpdate = async (id: string) => {
    try {
      await apiPatch(`/api/admin/users/${id}`, { name: editName.trim(), title: editTitle.trim() || null, roleId: editRoleId || null });
      setEditingId(null); refetch();
    } catch (err) { console.error(err); }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await apiPatch(`/api/admin/users/${id}`, { isActive: !isActive });
      refetch();
    } catch (err) { console.error(err); }
  };

  const handleRoleChange = async (userId: string, roleId: string) => {
    try {
      await apiPatch(`/api/admin/users/${userId}`, { roleId: roleId || null });
      refetch();
    } catch (err) { console.error(err); }
  };

  const activeCount = (users || []).filter((u) => u.isActive).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {users?.length || 0} users · {activeCount} active
          </p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
          <Plus size={16} /> Add User
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(roles || []).slice(0, 4).map((role) => (
          <div key={role.id} className="glass-card px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground">{role.name}</p>
            <p className="text-xl font-bold text-foreground mt-0.5">{role._count.users}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search by name or email..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="input pl-9 h-9 text-sm" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="input h-9 text-sm pr-8 appearance-none cursor-pointer min-w-[120px]">
          <option value="">All Users</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* User List */}
      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Users size={24} className="text-muted-foreground" />}
          title="No users found" description="Invite team members to collaborate."
          action={<button onClick={() => setShowCreateModal(true)} className="btn btn-primary"><Plus size={16} />Add User</button>} />
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Role</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Epics</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Stories</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">TCs</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Bugs</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map((user) => {
                  const isEditing = editingId === user.id;
                  return (
                    <tr key={user.id} className={cn("border-b border-border last:border-0 hover:bg-muted/20 transition-colors",
                      !user.isActive && "opacity-60")}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            {user.avatarUrl ? (
                              <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <span className="text-xs font-semibold text-primary">
                                {(user.name || user.email)[0]?.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            {isEditing ? (
                              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                                className="input h-7 text-sm" autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleUpdate(user.id); }} />
                            ) : (
                              <p className="text-sm font-medium text-foreground truncate">{user.name || "—"}</p>
                            )}
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                            className="input h-7 text-sm" placeholder="Job title" />
                        ) : (
                          <span className="text-sm text-muted-foreground">{user.title || "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select value={editRoleId} onChange={(e) => setEditRoleId(e.target.value)}
                            className="input h-7 text-sm min-w-[120px]">
                            <option value="">No Role</option>
                            {(roles || []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                        ) : (
                          <select value={user.role?.id || ""} onChange={(e) => handleRoleChange(user.id, e.target.value)}
                            className="text-xs bg-transparent border border-border rounded px-2 py-1 cursor-pointer hover:border-primary/30 transition-colors">
                            <option value="">No Role</option>
                            {(roles || []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-xs">{user._count.ownedEpics}</td>
                      <td className="px-4 py-3 text-center text-xs">{user._count.ownedStories}</td>
                      <td className="px-4 py-3 text-center text-xs">{user._count.reviewedTestCases}</td>
                      <td className="px-4 py-3 text-center text-xs">{user._count.reportedBugs}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => handleToggleActive(user.id, user.isActive)}
                          className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors",
                            user.isActive ? "bg-success/10 text-success hover:bg-success/20" : "bg-destructive/10 text-destructive hover:bg-destructive/20")}>
                          {user.isActive ? <><UserCheck size={10} /> Active</> : <><UserX size={10} /> Inactive</>}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => handleUpdate(user.id)} className="btn-icon btn-ghost"><Save size={14} /></button>
                            <button onClick={() => setEditingId(null)} className="btn-icon btn-ghost"><X size={14} /></button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditingId(user.id); setEditName(user.name || ""); setEditTitle(user.title || ""); setEditRoleId(user.role?.id || ""); }}
                            className="btn-icon btn-ghost"><Pencil size={14} /></button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      <Modal open={showCreateModal} onClose={() => { setShowCreateModal(false); setNewName(""); setNewEmail(""); setNewTitle(""); setNewRoleId(""); }}
        title="Add User" description="Add a team member to the system">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Full Name <span className="text-destructive">*</span></label>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="Ahmed Mohammed" className="input" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Email <span className="text-destructive">*</span></label>
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
              placeholder="ahmed@izam.co" className="input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Job Title</label>
            <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              placeholder="QC Engineer" className="input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Role</label>
            <select value={newRoleId} onChange={(e) => setNewRoleId(e.target.value)} className="input">
              <option value="">No Role</option>
              {(roles || []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { setShowCreateModal(false); setNewName(""); setNewEmail(""); setNewTitle(""); setNewRoleId(""); }} className="btn btn-outline">Cancel</button>
            <button onClick={handleCreate} disabled={!newName.trim() || !newEmail.trim() || creating} className="btn btn-primary disabled:opacity-50">
              {creating ? "Adding..." : "Add User"}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
