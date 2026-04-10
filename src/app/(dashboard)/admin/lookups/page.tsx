"use client";

import { useState } from "react";
import { useFetch, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Settings, Plus, Pencil, Trash2, Save, X, ChevronDown, ChevronRight,
  Lock, GripVertical, Eye, EyeOff, Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LookupValue {
  id: string; value: string; color: string | null;
  sortOrder: number; isActive: boolean; isDefault: boolean;
}
interface LookupCategory {
  id: string; name: string; description: string | null; isSystem: boolean;
  values: LookupValue[];
  _count: { fieldConfigs: number };
}

export default function LookupsAdminPage() {
  const { data: categories, loading, refetch } = useFetch<LookupCategory[]>("/api/admin/lookups");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Value editing states
  const [showAddValue, setShowAddValue] = useState<string | null>(null);
  const [newValueText, setNewValueText] = useState("");
  const [newValueColor, setNewValueColor] = useState("#6B7280");
  const [editingValueId, setEditingValueId] = useState<string | null>(null);
  const [editValueText, setEditValueText] = useState("");
  const [editValueColor, setEditValueColor] = useState("");

  // Category editing
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatDesc, setEditCatDesc] = useState("");

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    setCreating(true);
    try {
      await apiPost("/api/admin/lookups", { name: newCatName.trim(), description: newCatDesc.trim() || null });
      setNewCatName(""); setNewCatDesc(""); setShowCreateModal(false);
      refetch();
    } catch (err) { console.error(err); }
    finally { setCreating(false); }
  };

  const handleUpdateCategory = async (id: string) => {
    try {
      await apiPatch(`/api/admin/lookups/${id}`, { name: editCatName.trim(), description: editCatDesc.trim() || null });
      setEditingCatId(null); refetch();
    } catch (err) { console.error(err); }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Delete this category and all its values?")) return;
    try { await apiDelete(`/api/admin/lookups/${id}`); refetch(); }
    catch (err) { console.error(err); }
  };

  const handleAddValue = async (categoryId: string) => {
    if (!newValueText.trim()) return;
    try {
      await apiPost(`/api/admin/lookups/${categoryId}/values`, {
        value: newValueText.trim(), color: newValueColor,
      });
      setNewValueText(""); setNewValueColor("#6B7280"); setShowAddValue(null);
      refetch();
    } catch (err) { console.error(err); }
  };

  const handleUpdateValue = async (categoryId: string, valueId: string) => {
    try {
      await apiPatch(`/api/admin/lookups/${categoryId}/values`, {
        valueId, value: editValueText.trim(), color: editValueColor,
      });
      setEditingValueId(null); refetch();
    } catch (err) { console.error(err); }
  };

  const handleToggleValue = async (categoryId: string, valueId: string, isActive: boolean) => {
    try {
      await apiPatch(`/api/admin/lookups/${categoryId}/values`, { valueId, isActive: !isActive });
      refetch();
    } catch (err) { console.error(err); }
  };

  const handleDeleteValue = async (categoryId: string, valueId: string) => {
    if (!confirm("Delete this value?")) return;
    try {
      await apiDelete(`/api/admin/lookups/${categoryId}/values?valueId=${valueId}`);
      refetch();
    } catch (err) { console.error(err); }
  };

  const PRESET_COLORS = ["#EF4444", "#F59E0B", "#22C55E", "#3B82F6", "#6366F1", "#8B5CF6", "#EC4899", "#06B6D4", "#10B981", "#6B7280", "#DC2626", "#9CA3AF"];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lookup Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {categories?.length || 0} categories · Manage dropdown values used across the system
          </p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
          <Plus size={16} /> New Category
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : !categories || categories.length === 0 ? (
        <EmptyState icon={<Settings size={24} className="text-muted-foreground" />}
          title="No lookup categories" description="Create categories to define dropdown values."
          action={<button onClick={() => setShowCreateModal(true)} className="btn btn-primary"><Plus size={16} />Create Category</button>} />
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => {
            const isExpanded = expandedId === cat.id;
            const isEditing = editingCatId === cat.id;
            return (
              <div key={cat.id} className="glass-card overflow-hidden">
                {/* Category Header */}
                <div className="flex items-center gap-3 px-5 py-3.5">
                  <button onClick={() => setExpandedId(isExpanded ? null : cat.id)}
                    className="shrink-0 text-muted-foreground hover:text-foreground">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  {isEditing ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input type="text" value={editCatName} onChange={(e) => setEditCatName(e.target.value)}
                        className="input h-8 text-sm flex-1" autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter") handleUpdateCategory(cat.id); if (e.key === "Escape") setEditingCatId(null); }} />
                      <input type="text" value={editCatDesc} onChange={(e) => setEditCatDesc(e.target.value)}
                        className="input h-8 text-sm flex-1" placeholder="Description" />
                      <button onClick={() => handleUpdateCategory(cat.id)} className="btn-icon btn-ghost"><Save size={14} /></button>
                      <button onClick={() => setEditingCatId(null)} className="btn-icon btn-ghost"><X size={14} /></button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground">{cat.name}</h3>
                          {cat.isSystem && (
                            <span className="flex items-center gap-1 text-[10px] text-warning bg-warning/10 px-1.5 py-0.5 rounded">
                              <Lock size={9} /> System
                            </span>
                          )}
                        </div>
                        {cat.description && <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-muted-foreground">{cat.values.length} values</span>
                        {cat._count.fieldConfigs > 0 && (
                          <span className="text-xs text-muted-foreground">{cat._count.fieldConfigs} fields</span>
                        )}
                        <button onClick={() => { setEditingCatId(cat.id); setEditCatName(cat.name); setEditCatDesc(cat.description || ""); }}
                          className="btn-icon btn-ghost"><Pencil size={14} /></button>
                        {!cat.isSystem && (
                          <button onClick={() => handleDeleteCategory(cat.id)}
                            className="btn-icon btn-ghost text-destructive"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Expanded Values */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/10">
                    {/* Values list */}
                    <div className="divide-y divide-border/50">
                      {cat.values.map((val) => (
                        <div key={val.id} className="flex items-center gap-3 px-5 py-2.5 pl-12 group">
                          {editingValueId === val.id ? (
                            <>
                              <div className="flex items-center gap-2 flex-1">
                                <input type="color" value={editValueColor}
                                  onChange={(e) => setEditValueColor(e.target.value)}
                                  className="w-7 h-7 rounded cursor-pointer border-0 p-0" />
                                <input type="text" value={editValueText} onChange={(e) => setEditValueText(e.target.value)}
                                  className="input h-7 text-sm flex-1" autoFocus
                                  onKeyDown={(e) => { if (e.key === "Enter") handleUpdateValue(cat.id, val.id); if (e.key === "Escape") setEditingValueId(null); }} />
                              </div>
                              <button onClick={() => handleUpdateValue(cat.id, val.id)} className="btn-icon btn-ghost"><Save size={12} /></button>
                              <button onClick={() => setEditingValueId(null)} className="btn-icon btn-ghost"><X size={12} /></button>
                            </>
                          ) : (
                            <>
                              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: val.color || "#6B7280" }} />
                              <span className={cn("text-sm flex-1", !val.isActive && "line-through text-muted-foreground")}>{val.value}</span>
                              {val.isDefault && <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">Default</span>}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleToggleValue(cat.id, val.id, val.isActive)}
                                  className="btn-icon btn-ghost" title={val.isActive ? "Deactivate" : "Activate"}>
                                  {val.isActive ? <Eye size={12} /> : <EyeOff size={12} />}
                                </button>
                                <button onClick={() => { setEditingValueId(val.id); setEditValueText(val.value); setEditValueColor(val.color || "#6B7280"); }}
                                  className="btn-icon btn-ghost"><Pencil size={12} /></button>
                                <button onClick={() => handleDeleteValue(cat.id, val.id)}
                                  className="btn-icon btn-ghost text-destructive"><Trash2 size={12} /></button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Add Value */}
                    {showAddValue === cat.id ? (
                      <div className="flex items-center gap-2 px-5 py-3 pl-12 border-t border-border/50 bg-muted/20">
                        <input type="color" value={newValueColor} onChange={(e) => setNewValueColor(e.target.value)}
                          className="w-7 h-7 rounded cursor-pointer border-0 p-0" />
                        <input type="text" value={newValueText} onChange={(e) => setNewValueText(e.target.value)}
                          placeholder="Value name..." className="input h-8 text-sm flex-1" autoFocus
                          onKeyDown={(e) => { if (e.key === "Enter") handleAddValue(cat.id); if (e.key === "Escape") { setShowAddValue(null); setNewValueText(""); } }} />
                        <div className="flex gap-1 flex-wrap max-w-[180px]">
                          {PRESET_COLORS.slice(0, 6).map((c) => (
                            <button key={c} onClick={() => setNewValueColor(c)}
                              className={cn("w-5 h-5 rounded-full border-2 transition-all", newValueColor === c ? "border-foreground scale-110" : "border-transparent")}
                              style={{ background: c }} />
                          ))}
                        </div>
                        <button onClick={() => handleAddValue(cat.id)} disabled={!newValueText.trim()}
                          className="btn btn-primary btn-sm disabled:opacity-50">Add</button>
                        <button onClick={() => { setShowAddValue(null); setNewValueText(""); }}
                          className="btn btn-ghost btn-sm">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => { setShowAddValue(cat.id); setNewValueColor("#6B7280"); }}
                        className="flex items-center gap-2 px-5 py-2.5 pl-12 text-xs text-muted-foreground hover:text-primary hover:bg-muted/30 w-full transition-colors border-t border-border/50">
                        <Plus size={12} /> Add value
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Category Modal */}
      <Modal open={showCreateModal} onClose={() => { setShowCreateModal(false); setNewCatName(""); setNewCatDesc(""); }}
        title="Create Lookup Category" description="Define a new category for dropdown values">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Category Name <span className="text-destructive">*</span></label>
            <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
              placeholder="e.g., Test Environment" className="input" autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreateCategory()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
            <input type="text" value={newCatDesc} onChange={(e) => setNewCatDesc(e.target.value)}
              placeholder="Optional description" className="input" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { setShowCreateModal(false); setNewCatName(""); setNewCatDesc(""); }} className="btn btn-outline">Cancel</button>
            <button onClick={handleCreateCategory} disabled={!newCatName.trim() || creating} className="btn btn-primary disabled:opacity-50">
              {creating ? "Creating..." : "Create Category"}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
