"use client";

import { useState } from "react";
import { useFetch, apiPatch } from "@/lib/api";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Settings, Eye, EyeOff, ChevronDown, ChevronRight, Save,
  FileText, ListChecks, TestTube2, Bug, Asterisk,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FieldConfig {
  id: string; entityType: string; fieldKey: string; fieldLabel: string;
  fieldType: string; isRequired: boolean; isVisible: boolean;
  defaultValue: string | null; sortOrder: number;
  lookupCategory: { id: string; name: string } | null;
}

const ENTITY_ICONS: Record<string, React.ElementType> = {
  epic: FileText, story: ListChecks, test_case: TestTube2, bug: Bug,
};
const ENTITY_LABELS: Record<string, string> = {
  epic: "Epics", story: "User Stories", test_case: "Test Cases", bug: "Production Bugs",
};
const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Text", number: "Number", date: "Date",
  lookup: "Lookup", "user-select": "User", "rich-text": "Rich Text",
};

export default function FieldsAdminPage() {
  const { data: configs, loading, refetch } = useFetch<FieldConfig[]>("/api/admin/fields");
  const [expandedEntity, setExpandedEntity] = useState<string | null>(null);

  const handleToggleVisible = async (id: string, isVisible: boolean) => {
    try {
      await apiPatch("/api/admin/fields", { id, isVisible: !isVisible });
      refetch();
    } catch (err) { console.error(err); }
  };

  const handleToggleRequired = async (id: string, isRequired: boolean) => {
    try {
      await apiPatch("/api/admin/fields", { id, isRequired: !isRequired });
      refetch();
    } catch (err) { console.error(err); }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="skeleton h-8 w-64" />
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
      </div>
    );
  }

  if (!configs || configs.length === 0) {
    return <EmptyState icon={<Settings size={24} className="text-muted-foreground" />}
      title="No field configurations" description="Run the seed script to populate field configs." />;
  }

  // Group by entity type
  const grouped = configs.reduce<Record<string, FieldConfig[]>>((acc, config) => {
    if (!acc[config.entityType]) acc[config.entityType] = [];
    acc[config.entityType].push(config);
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Field Configuration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Control which fields are visible and required for each entity type
        </p>
      </div>

      <div className="space-y-3">
        {Object.entries(grouped).map(([entityType, fields]) => {
          const isExpanded = expandedEntity === entityType;
          const Icon = ENTITY_ICONS[entityType] || Settings;
          const label = ENTITY_LABELS[entityType] || entityType;
          const visibleCount = fields.filter((f) => f.isVisible).length;
          const requiredCount = fields.filter((f) => f.isRequired).length;

          return (
            <div key={entityType} className="glass-card overflow-hidden">
              <button onClick={() => setExpandedEntity(isExpanded ? null : entityType)}
                className="flex items-center gap-3 w-full px-5 py-4 hover:bg-muted/20 transition-colors text-left">
                {isExpanded ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
                <Icon size={18} className="text-primary shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground">{label}</h3>
                  <p className="text-xs text-muted-foreground">{fields.length} fields · {visibleCount} visible · {requiredCount} required</p>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Field</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Key</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Lookup</th>
                          <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Visible</th>
                          <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Required</th>
                          <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">Order</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fields.map((field) => (
                          <tr key={field.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                            <td className="px-4 py-2.5 font-medium text-foreground">{field.fieldLabel}</td>
                            <td className="px-4 py-2.5">
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">{field.fieldKey}</code>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                {FIELD_TYPE_LABELS[field.fieldType] || field.fieldType}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">
                              {field.lookupCategory?.name || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <button onClick={() => handleToggleVisible(field.id, field.isVisible)}
                                className={cn("btn-icon transition-colors", field.isVisible ? "text-success hover:text-success/70" : "text-muted-foreground hover:text-foreground")}>
                                {field.isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                              </button>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <button onClick={() => handleToggleRequired(field.id, field.isRequired)}
                                className={cn("btn-icon transition-colors", field.isRequired ? "text-destructive hover:text-destructive/70" : "text-muted-foreground hover:text-foreground")}>
                                <Asterisk size={16} />
                              </button>
                            </td>
                            <td className="px-4 py-2.5 text-center text-xs text-muted-foreground">{field.sortOrder}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
