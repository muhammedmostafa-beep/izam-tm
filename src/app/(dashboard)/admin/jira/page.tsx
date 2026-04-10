"use client";

import { useState, useCallback } from "react";
import { useFetch, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Link2, Plus, RefreshCw, Trash2,
  CheckCircle2, XCircle, Activity, Globe, Zap,
  Search, FolderKanban, LayoutDashboard, ChevronRight,
  Loader2, ShieldCheck, ArrowLeft, Eye, EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Interfaces ────────────────────────────────── */

interface JiraMapping {
  id: string; jiraProjectKey: string; jiraProjectName: string | null;
  tmEpic: { id: string; epicId: string; epicTitle: string } | null;
}
interface JiraConfig {
  id: string; jiraSiteUrl: string; syncIntervalMinutes: number;
  isActive: boolean; createdAt: string;
  configuredBy: { id: string; name: string; email: string };
  projectMappings: JiraMapping[];
  _count: { syncLogs: number };
}
interface SyncLog {
  id: string; projectKey: string | null;
  itemsCreated: number; itemsUpdated: number; itemsSkipped: number; itemsFailed: number;
  startedAt: string; completedAt: string | null;
}
interface JiraProject {
  id: string; key: string; name: string; projectTypeKey: string;
  avatarUrls: Record<string, string>;
}
interface JiraBoard {
  id: number; name: string; type: string;
  location?: { projectKey?: string; projectName?: string };
}
interface JiraSprint {
  id: number; name: string; state: string;
  startDate?: string; endDate?: string; goal?: string;
}

/* ── Main Page ─────────────────────────────────── */

export default function JiraAdminPage() {
  const { data: configs, loading, refetch } = useFetch<JiraConfig[]>("/api/admin/jira");
  const [showCreate, setShowCreate] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [showLogsId, setShowLogsId] = useState<string | null>(null);

  // Explore panel state
  const [exploreConfig, setExploreConfig] = useState<JiraConfig | null>(null);

  const handleSync = async (configId: string) => {
    setSyncingId(configId);
    try { await apiPost(`/api/admin/jira/${configId}/sync`, {}); refetch(); }
    catch (err) { console.error(err); }
    finally { setSyncingId(null); }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try { await apiPatch(`/api/admin/jira/${id}`, { isActive: !isActive }); refetch(); }
    catch (err) { console.error(err); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this Jira configuration?")) return;
    try { await apiDelete(`/api/admin/jira/${id}`); refetch(); }
    catch (err) { console.error(err); }
  };

  const loadSyncLogs = async (configId: string) => {
    if (showLogsId === configId) { setShowLogsId(null); return; }
    try {
      const res = await fetch(`/api/admin/jira/${configId}/sync`);
      const data = await res.json();
      setSyncLogs(data);
      setShowLogsId(configId);
    } catch (err) { console.error(err); }
  };

  // If exploring a config, show the explorer panel
  if (exploreConfig) {
    return (
      <JiraExplorer
        config={exploreConfig}
        onBack={() => setExploreConfig(null)}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Jira Integration</h1>
          <p className="text-sm text-muted-foreground mt-1">Connect and sync with Jira projects</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary"><Plus size={16} /> Add Connection</button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="skeleton h-32 rounded-xl" />)}</div>
      ) : !configs || configs.length === 0 ? (
        <EmptyState icon={<Link2 size={24} className="text-muted-foreground" />}
          title="No Jira connections" description="Connect your Jira instance to browse projects and sync data."
          action={<button onClick={() => setShowCreate(true)} className="btn btn-primary"><Plus size={16} />Add Connection</button>} />
      ) : (
        <div className="space-y-4">
          {configs.map((config) => (
            <div key={config.id} className="glass-card overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                      config.isActive ? "bg-primary/10" : "bg-muted")}>
                      <Globe size={20} className={config.isActive ? "text-primary" : "text-muted-foreground"} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{config.jiraSiteUrl}</h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>Sync every {config.syncIntervalMinutes}m</span>
                        <span>·</span>
                        <span>{config._count.syncLogs} syncs</span>
                        <span>·</span>
                        <span>{config.projectMappings.length} mappings</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Configured by {config.configuredBy.name} · {new Date(config.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setExploreConfig(config)} className="btn btn-outline btn-sm">
                      <Search size={14} /> Browse Projects
                    </button>
                    <button onClick={() => handleSync(config.id)} disabled={syncingId === config.id}
                      className="btn btn-outline btn-sm">
                      <RefreshCw size={14} className={syncingId === config.id ? "animate-spin" : ""} />
                      {syncingId === config.id ? "Syncing..." : "Sync Now"}
                    </button>
                    <button onClick={() => handleToggle(config.id, config.isActive)}
                      className={cn("btn btn-sm", config.isActive ? "btn-outline text-success" : "btn-outline text-muted-foreground")}>
                      {config.isActive ? <><CheckCircle2 size={14} /> Active</> : <><XCircle size={14} /> Disabled</>}
                    </button>
                    <button onClick={() => handleDelete(config.id)} className="btn-icon btn-ghost text-destructive"><Trash2 size={14} /></button>
                  </div>
                </div>

                {/* Project Mappings */}
                {config.projectMappings.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {config.projectMappings.map((m) => (
                      <div key={m.id} className="inline-flex items-center gap-2 text-xs bg-muted px-3 py-1.5 rounded-lg">
                        <span className="font-mono font-semibold">{m.jiraProjectKey}</span>
                        {m.tmEpic && <><span className="text-muted-foreground">→</span><span>{m.tmEpic.epicId}</span></>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Sync Logs Toggle */}
                <button onClick={() => loadSyncLogs(config.id)}
                  className="text-xs text-primary hover:underline mt-3 flex items-center gap-1">
                  <Activity size={10} /> {showLogsId === config.id ? "Hide" : "View"} sync history
                </button>
              </div>

              {/* Sync Logs */}
              {showLogsId === config.id && syncLogs.length > 0 && (
                <div className="border-t border-border bg-muted/10">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-border/50">
                        <th className="text-left px-4 py-2 text-muted-foreground">Time</th>
                        <th className="text-left px-4 py-2 text-muted-foreground">Project</th>
                        <th className="text-center px-4 py-2 text-success">Created</th>
                        <th className="text-center px-4 py-2 text-primary">Updated</th>
                        <th className="text-center px-4 py-2 text-muted-foreground">Skipped</th>
                        <th className="text-center px-4 py-2 text-destructive">Failed</th>
                      </tr></thead>
                      <tbody>
                        {syncLogs.map((log) => (
                          <tr key={log.id} className="border-b border-border/30 last:border-0">
                            <td className="px-4 py-2">{new Date(log.startedAt).toLocaleString()}</td>
                            <td className="px-4 py-2 font-mono">{log.projectKey || "—"}</td>
                            <td className="px-4 py-2 text-center text-success">{log.itemsCreated}</td>
                            <td className="px-4 py-2 text-center text-primary">{log.itemsUpdated}</td>
                            <td className="px-4 py-2 text-center text-muted-foreground">{log.itemsSkipped}</td>
                            <td className="px-4 py-2 text-center text-destructive">{log.itemsFailed}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <CreateConnectionModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={refetch}
      />
    </div>
  );
}

/* ── Create Connection Modal ───────────────────── */

function CreateConnectionModal({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; serverInfo?: { serverTitle: string }; error?: string } | null>(null);
  const [creating, setCreating] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiPost<{ success: boolean; serverInfo?: { serverTitle: string }; error?: string }>(
        "/api/admin/jira/connect",
        { action: "test", siteUrl: url.trim(), email: email.trim(), apiToken }
      );
      setTestResult(res);
    } catch (err) {
      setTestResult({ success: false, error: err instanceof Error ? err.message : "Failed" });
    } finally {
      setTesting(false);
    }
  };

  const handleCreate = async () => {
    if (!url.trim() || !email.trim() || !apiToken.trim()) return;
    setCreating(true);
    try {
      await apiPost("/api/admin/jira", {
        jiraSiteUrl: url.trim(),
        email: email.trim(),
        apiToken: apiToken.trim(),
      });
      reset();
      onClose();
      onCreated();
    } catch (err) { console.error(err); }
    finally { setCreating(false); }
  };

  const reset = () => {
    setUrl(""); setEmail(""); setApiToken(""); setTestResult(null); setShowToken(false);
  };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }}
      title="Add Jira Connection" description="Connect to a Jira Cloud instance">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Jira Site URL <span className="text-destructive">*</span></label>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-org.atlassian.net" className="input" autoFocus />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Jira Email <span className="text-destructive">*</span></label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@izam.co" className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            API Token <span className="text-destructive">*</span>
            <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noreferrer"
              className="text-xs text-primary hover:underline ml-2">Generate token ↗</a>
          </label>
          <div className="relative">
            <input type={showToken ? "text" : "password"} value={apiToken} onChange={(e) => setApiToken(e.target.value)}
              placeholder="Your Jira API token" className="input pr-10" />
            <button type="button" onClick={() => setShowToken(!showToken)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1">
              {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        {/* Test Result */}
        {testResult && (
          <div className={cn("p-3 rounded-lg text-sm flex items-center gap-2",
            testResult.success ? "bg-success/10 text-success border border-success/20" : "bg-destructive/10 text-destructive border border-destructive/20")}>
            {testResult.success ? <ShieldCheck size={16} /> : <XCircle size={16} />}
            {testResult.success
              ? `Connected to ${testResult.serverInfo?.serverTitle || "Jira"}`
              : testResult.error || "Connection failed"}
          </div>
        )}

        <div className="flex justify-between gap-2 pt-2">
          <button onClick={handleTest}
            disabled={!url.trim() || !email.trim() || !apiToken.trim() || testing}
            className="btn btn-outline disabled:opacity-50">
            {testing ? <><Loader2 size={14} className="animate-spin" /> Testing...</> : <><Zap size={14} /> Test Connection</>}
          </button>
          <div className="flex gap-2">
            <button onClick={() => { reset(); onClose(); }} className="btn btn-outline">Cancel</button>
            <button onClick={handleCreate}
              disabled={!url.trim() || creating}
              className="btn btn-primary disabled:opacity-50">
              {creating ? "Saving..." : "Save Connection"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ── Jira Explorer Panel ───────────────────────── */

function JiraExplorer({
  config,
  onBack,
}: {
  config: JiraConfig;
  onBack: () => void;
}) {
  const [email, setEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connError, setConnError] = useState("");
  const [serverTitle, setServerTitle] = useState("");

  // Projects
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [projectSearch, setProjectSearch] = useState("");
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Mapping
  const [mappingProject, setMappingProject] = useState<JiraProject | null>(null);
  const [mappingLoading, setMappingLoading] = useState(false);

  // Boards
  const [selectedProject, setSelectedProject] = useState<JiraProject | null>(null);
  const [boards, setBoards] = useState<JiraBoard[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(false);

  // Sprints
  const [selectedBoard, setSelectedBoard] = useState<JiraBoard | null>(null);
  const [sprints, setSprints] = useState<JiraSprint[]>([]);
  const [loadingSprints, setLoadingSprints] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    setConnError("");
    try {
      const res = await apiPost<{ success: boolean; serverInfo?: { serverTitle: string }; error?: string }>(
        `/api/admin/jira/${config.id}/explore`,
        { action: "test", email: email.trim(), apiToken }
      );
      if (res.success) {
        setConnected(true);
        setServerTitle(res.serverInfo?.serverTitle || "Jira");
        // Auto-load projects
        fetchProjects();
      } else {
        setConnError(res.error || "Connection failed");
      }
    } catch (err) {
      setConnError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  const handleMapProject = async (project: JiraProject) => {
    setMappingLoading(true);
    try {
      await apiPost(`/api/admin/jira/${config.id}/mappings`, {
        jiraProjectKey: project.key,
        jiraProjectName: project.name,
        createNewEpic: true, // Auto-create an epic for it for simplicity
      });
      alert(`Successfully mapped ${project.key} to a new TM Epic! You can now Sync the connection to pull all its items into the system.`);
      setMappingProject(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to map project");
    } finally {
      setMappingLoading(false);
    }
  };

  const fetchProjects = useCallback(async (query?: string) => {
    setLoadingProjects(true);
    try {
      const res = await apiPost<{ projects: JiraProject[] }>(
        `/api/admin/jira/${config.id}/explore`,
        { action: "projects", email: email.trim(), apiToken, query }
      );
      setProjects(res.projects || []);
    } catch (err) { console.error(err); }
    finally { setLoadingProjects(false); }
  }, [config.id, email, apiToken]);

  const fetchBoards = async (project: JiraProject) => {
    setSelectedProject(project);
    setSelectedBoard(null);
    setSprints([]);
    setLoadingBoards(true);
    try {
      const res = await apiPost<{ boards: JiraBoard[] }>(
        `/api/admin/jira/${config.id}/explore`,
        { action: "boards", email: email.trim(), apiToken, projectKey: project.key }
      );
      setBoards(res.boards || []);
    } catch (err) { console.error(err); }
    finally { setLoadingBoards(false); }
  };

  const fetchSprints = async (board: JiraBoard) => {
    setSelectedBoard(board);
    setLoadingSprints(true);
    try {
      const res = await apiPost<{ sprints: JiraSprint[] }>(
        `/api/admin/jira/${config.id}/explore`,
        { action: "sprints", email: email.trim(), apiToken, boardId: board.id }
      );
      setSprints(res.sprints || []);
    } catch (err) { console.error(err); }
    finally { setLoadingSprints(false); }
  };

  // Debounced project search
  const handleProjectSearch = (value: string) => {
    setProjectSearch(value);
    // Simple debounce via setTimeout
    const timer = setTimeout(() => fetchProjects(value), 400);
    return () => clearTimeout(timer);
  };

  const boardTypeIcon = (type: string) => {
    switch (type) {
      case "scrum": return <LayoutDashboard size={14} className="text-primary" />;
      case "kanban": return <FolderKanban size={14} className="text-accent" />;
      default: return <LayoutDashboard size={14} className="text-muted-foreground" />;
    }
  };

  const sprintStateBadge = (state: string) => {
    switch (state) {
      case "active": return "badge badge-success";
      case "future": return "badge badge-primary";
      case "closed": return "badge badge-secondary";
      default: return "badge";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="btn-icon btn-ghost"><ArrowLeft size={18} /></button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Browse Jira</h1>
          <p className="text-sm text-muted-foreground">{config.jiraSiteUrl}</p>
        </div>
      </div>

      {/* Auth Panel */}
      {!connected ? (
        <div className="glass-card p-6 max-w-lg">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <ShieldCheck size={18} className="text-primary" /> Authenticate
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Enter your Jira email and API token to browse projects and boards.
          </p>
          <div className="space-y-3">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Jira email (e.g. you@izam.co)" className="input" />
            <div className="relative">
              <input type={showToken ? "text" : "password"} value={apiToken} onChange={(e) => setApiToken(e.target.value)}
                placeholder="Jira API token" className="input pr-10"
                onKeyDown={(e) => e.key === "Enter" && handleConnect()} />
              <button type="button" onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1">
                {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {connError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm border border-destructive/20 flex items-center gap-2">
                <XCircle size={14} /> {connError}
              </div>
            )}
            <button onClick={handleConnect}
              disabled={!email.trim() || !apiToken.trim() || connecting}
              className="btn btn-primary w-full disabled:opacity-50">
              {connecting ? <><Loader2 size={14} className="animate-spin" /> Connecting...</> : <><Zap size={14} /> Connect & Browse</>}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Connected Banner */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-success/5 border border-success/20">
            <ShieldCheck size={18} className="text-success" />
            <span className="text-sm text-success font-medium">Connected to {serverTitle}</span>
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <button onClick={() => { setSelectedProject(null); setSelectedBoard(null); setSprints([]); }}
              className={cn("hover:text-foreground transition-colors", !selectedProject && "text-foreground font-semibold")}>
              Projects
            </button>
            {selectedProject && (
              <>
                <ChevronRight size={14} />
                <button onClick={() => { setSelectedBoard(null); setSprints([]); }}
                  className={cn("hover:text-foreground transition-colors", !selectedBoard && "text-foreground font-semibold")}>
                  {selectedProject.key} — Boards
                </button>
              </>
            )}
            {selectedBoard && (
              <>
                <ChevronRight size={14} />
                <span className="text-foreground font-semibold">{selectedBoard.name} — Sprints</span>
              </>
            )}
          </div>

          {/* ─── PROJECTS ─── */}
          {!selectedProject && (
            <div className="space-y-4">
              <div className="relative max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" value={projectSearch}
                  onChange={(e) => handleProjectSearch(e.target.value)}
                  placeholder="Search projects..."
                  className="input pl-9 h-9 text-sm" />
              </div>

              {loadingProjects ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                  <Loader2 size={16} className="animate-spin" /> Loading projects...
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FolderKanban size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No projects found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {projects.map((project) => (
                    <div key={project.id} className="glass-card flex flex-col group overflow-hidden hover:border-primary/40 transition-colors">
                      <button 
                        onClick={() => fetchBoards(project)}
                        className="p-4 text-left flex-1"
                      >
                        <div className="flex items-start gap-3">
                          {project.avatarUrls?.["24x24"] ? (
                            <img src={project.avatarUrls["24x24"]} alt="" className="w-8 h-8 rounded" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {project.key.slice(0, 2)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-primary">{project.key}</span>
                              <ChevronRight size={12} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{project.projectTypeKey}</p>
                          </div>
                        </div>
                      </button>
                      <div className="px-4 py-2 bg-muted/40 border-t border-border flex justify-end">
                        <button 
                          onClick={() => setMappingProject(project)}
                          className="btn btn-outline btn-sm text-xs bg-background"
                        >
                          <Link2 size={12} /> Map to TM
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quick Mapping Confirmation Modal */}
          {mappingProject && (
            <Modal open={true} onClose={() => setMappingProject(null)} title="Map Jira Project" description={`Link ${mappingProject.name} to Traceability Matrix`}>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This will create a new TM Epic for <span className="font-semibold text-foreground">{mappingProject.key}</span> and allow it to sync future Stories and Bugs!
                </p>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setMappingProject(null)} className="btn btn-outline">Cancel</button>
                  <button onClick={() => handleMapProject(mappingProject)} disabled={mappingLoading} className="btn btn-primary disabled:opacity-50">
                    {mappingLoading ? "Mapping..." : "Create Mapping"}
                  </button>
                </div>
              </div>
            </Modal>
          )}

          {/* ─── BOARDS ─── */}
          {selectedProject && !selectedBoard && (
            <div className="space-y-4">
              {loadingBoards ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                  <Loader2 size={16} className="animate-spin" /> Loading boards...
                </div>
              ) : boards.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <LayoutDashboard size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No boards found for {selectedProject.key}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {boards.map((board) => (
                    <button key={board.id}
                      onClick={() => fetchSprints(board)}
                      className="glass-card p-4 text-left hover:border-primary/40 transition-all group">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                          {boardTypeIcon(board.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground truncate">{board.name}</p>
                            <ChevronRight size={12} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">
                            {board.type}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── SPRINTS ─── */}
          {selectedBoard && (
            <div className="space-y-4">
              {loadingSprints ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                  <Loader2 size={16} className="animate-spin" /> Loading sprints...
                </div>
              ) : sprints.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No sprints found for this board</p>
                  <p className="text-xs mt-1">This board may use Kanban (no sprints)</p>
                </div>
              ) : (
                <div className="glass-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Sprint</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">State</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Start</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">End</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Goal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sprints.map((sprint) => (
                        <tr key={sprint.id} className="border-b border-border/50 last:border-0 hover:bg-muted/10">
                          <td className="px-4 py-3 font-medium text-foreground">{sprint.name}</td>
                          <td className="px-4 py-3">
                            <span className={sprintStateBadge(sprint.state)}>{sprint.state}</span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {sprint.startDate ? new Date(sprint.startDate).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {sprint.endDate ? new Date(sprint.endDate).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs truncate max-w-[200px]">
                            {sprint.goal || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
