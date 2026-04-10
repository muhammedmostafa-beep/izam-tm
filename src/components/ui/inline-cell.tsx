"use client";

import { useState, useRef, useEffect } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Check, X } from "lucide-react";

interface InlineCellProps {
  value: string | null;
  field: string;
  entityId: string;
  onSave: (entityId: string, field: string, value: string) => Promise<void>;
  type?: "text" | "select";
  options?: string[];
}

export function InlineCell({ value, field, entityId, onSave, type = "text", options }: InlineCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  const handleSave = async () => {
    if (editValue === (value || "")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(entityId, field, editValue);
      setEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value || "");
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 min-w-[120px]">
        {type === "select" && options ? (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              // Auto-save on select change
              setSaving(true);
              onSave(entityId, field, e.target.value)
                .then(() => setEditing(false))
                .catch(console.error)
                .finally(() => setSaving(false));
            }}
            onBlur={handleCancel}
            className="input h-7 text-xs py-0 min-w-[100px]"
            disabled={saving}
          >
            <option value="">— None —</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : (
          <>
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="input h-7 text-xs py-0 min-w-[100px] flex-1"
              disabled={saving}
            />
            <button onClick={handleSave} className="btn-icon btn-ghost shrink-0 w-5 h-5" disabled={saving}>
              <Check size={10} className="text-success" />
            </button>
            <button onClick={handleCancel} className="btn-icon btn-ghost shrink-0 w-5 h-5">
              <X size={10} className="text-muted-foreground" />
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => { setEditValue(value || ""); setEditing(true); }}
      className="text-left w-full hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors cursor-pointer"
      title="Click to edit"
    >
      {value ? <StatusBadge value={value} /> : <span className="text-xs text-muted-foreground">—</span>}
    </button>
  );
}
