import { useState, useEffect, useCallback } from 'react';
import { Project, Service } from './types';
import Sidebar from './components/Sidebar';
import LogViewer from './components/LogViewer';
import AuthScreen from './components/AuthScreen';
import OrganizationSelect from './components/OrganizationSelect';
import CreateProjectModal from './components/CreateProjectModal';
import CreateServiceModal from './components/CreateServiceModal';
import { authClient } from './lib/auth-client';
import { Activity, LogOut, Plus, FolderPlus, Terminal, Copy, Check, Send, Users, Loader2 } from 'lucide-react';

/* Hallmark · macrostructure: 05-workbench · genre: modern-minimal · theme: Workbench Light */
export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [activeOrgName, setActiveOrgName] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<'read' | 'write'>('write');

  const [projects, setProjects] = useState<Project[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeServiceId, setActiveServiceId] = useState<string | null>(null);

  const [showCreateProject, setShowCreateProject] = useState(false);
  const [serviceModalTarget, setServiceModalTarget] = useState<Project | null>(null);
  const [copied, setCopied] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  // Invitation Prompt State
  const [inviteModalData, setInviteModalData] = useState<{
    invitationId: string;
    orgName?: string;
    role?: string;
  } | null>(null);
  const [inviteActionLoading, setInviteActionLoading] = useState(false);

  // Check pending invitation from URL and display review modal
  const checkPendingInviteUrl = async (userSession: any) => {
    const urlParams = new URLSearchParams(window.location.search);
    const invitationId = urlParams.get('invitation_id');
    if (invitationId && userSession) {
      try {
        const invRes = await authClient.organization.getInvitation({ query: { id: invitationId } } as any);
        const orgName = invRes.data?.organizationName || 'Workspace';
        const role = invRes.data?.role || 'read';
        setInviteModalData({ invitationId, orgName, role });
      } catch (e) {
        setInviteModalData({ invitationId, orgName: 'Workspace', role: 'member' });
      }
    }
  };

  const handleAcceptInvite = async () => {
    if (!inviteModalData) return;
    setInviteActionLoading(true);
    try {
      await authClient.organization.acceptInvitation({ invitationId: inviteModalData.invitationId });
      window.history.replaceState({}, '', window.location.pathname);
      setInviteModalData(null);
      await checkSession();
    } catch (e) {
      console.error('Failed to accept invitation:', e);
      window.history.replaceState({}, '', window.location.pathname);
      setInviteModalData(null);
    } finally {
      setInviteActionLoading(false);
    }
  };

  const handleRejectInvite = async () => {
    if (!inviteModalData) return;
    setInviteActionLoading(true);
    try {
      await authClient.organization.rejectInvitation({ invitationId: inviteModalData.invitationId });
      window.history.replaceState({}, '', window.location.pathname);
      setInviteModalData(null);
    } catch (e) {
      console.error('Failed to reject invitation:', e);
      window.history.replaceState({}, '', window.location.pathname);
      setInviteModalData(null);
    } finally {
      setInviteActionLoading(false);
    }
  };

  const checkSession = async () => {
    try {
      const res = await authClient.getSession({ query: {} } as any);
      setSession(res.data?.session);
      setCurrentUser(res.data?.user);

      if (res.data?.session) {
        await checkPendingInviteUrl(res.data.session);
        if (res.data.session.activeOrganizationId) {
          setActiveOrgId(res.data.session.activeOrganizationId);
        }
      }
    } catch(e) {}
    setLoading(false);
  };

  useEffect(() => {
    checkSession();
  }, []);

  // Fetch full organization details to determine current user role and org name
  useEffect(() => {
    if (activeOrgId && currentUser) {
      authClient.organization.getFullOrganization({ query: {} } as any).then((res: any) => {
        if (res.data) {
          setActiveOrgName(res.data.name || '');
          const myMember = res.data.members?.find((m: any) => m.userId === currentUser.id);
          const role = myMember?.role === 'read' ? 'read' : 'write';
          setCurrentUserRole(role);
        }
      }).catch(() => {});
    }
  }, [activeOrgId, currentUser]);

  const loadProjects = useCallback(async () => {
    if (!activeOrgId) return [];
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (Array.isArray(data)) {
        setProjects(data);
        return data;
      }
    } catch (e) {}
    return [];
  }, [activeOrgId]);

  const loadServices = useCallback(async () => {
    if (!activeOrgId) return [];
    try {
      const res = await fetch('/api/services');
      const data = await res.json();
      if (Array.isArray(data)) {
        setServices(data);
        return data;
      }
    } catch (e) {}
    return [];
  }, [activeOrgId]);

  useEffect(() => {
    if (activeOrgId) {
      loadProjects().then(projs => {
        if (projs.length > 0 && !activeProjectId) {
          setActiveProjectId(projs[0].id);
        }
      });
      loadServices();
    }
  }, [activeOrgId, loadProjects, loadServices]);

  // Sync active service when active project changes
  useEffect(() => {
    if (activeProjectId) {
      const projServices = services.filter(s => s.project_id === activeProjectId);
      if (projServices.length > 0) {
        if (!activeServiceId || !projServices.some(s => s.id === activeServiceId)) {
          setActiveServiceId(projServices[0].id);
        }
      } else {
        setActiveServiceId(null);
      }
    }
  }, [activeProjectId, services]);

  const handleProjectCreated = async (newProject: any) => {
    await loadProjects();
    await loadServices();
    setActiveProjectId(newProject.id);
    if (newProject.defaultService?.id) {
      setActiveServiceId(newProject.defaultService.id);
    } else {
      setActiveServiceId(null);
    }
  };

  const handleServiceCreated = async (newService: any) => {
    await loadServices();
    setActiveProjectId(newService.project_id);
    setActiveServiceId(newService.id);
  };

  const handleProjectDeleted = async (deletedId: string) => {
    const updated = await loadProjects();
    await loadServices();
    if (activeProjectId === deletedId) {
      if (updated.length > 0) {
        setActiveProjectId(updated[0].id);
      } else {
        setActiveProjectId(null);
        setActiveServiceId(null);
      }
    }
  };

  const handleServiceDeleted = async (deletedId: string) => {
    const updated = await loadServices();
    if (activeServiceId === deletedId) {
      const remaining = updated.filter((s: any) => s.project_id === activeProjectId);
      if (remaining.length > 0) {
        setActiveServiceId(remaining[0].id);
      } else {
        setActiveServiceId(null);
      }
    }
  };

  const handleSendTestLog = async (projName: string, serviceName = "api") => {
    setSendingTest(true);
    try {
      await fetch('/v1/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: projName,
          service: serviceName,
          level: 'info',
          event: 'system.boot',
          message: `Test log received for ${projName}/${serviceName}`,
          timestamp: new Date().toISOString(),
          metadata: { env: 'production', status: 200 }
        })
      });

      const updatedServices = await loadServices();
      const targetService = updatedServices.find(
        (s: any) => s.project_id === activeProjectId && (s.name === serviceName || s.id === serviceName)
      );
      if (targetService) {
        setActiveServiceId(targetService.id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbfbfa] flex items-center justify-center text-zinc-500 font-mono text-xs">
        <Activity className="w-4 h-4 animate-spin text-zinc-400 mr-2" />
        <span>Loading CalmLogs...</span>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen onLogin={checkSession} />;
  }

  if (!activeOrgId) {
    return <OrganizationSelect onComplete={checkSession} />;
  }

  const activeProject = projects.find(p => p.id === activeProjectId);
  const activeService = services.find(s => s.id === activeServiceId);
  const activeProjectServices = activeProjectId ? services.filter(s => s.project_id === activeProjectId) : [];
  const isWrite = currentUserRole === 'write';

  const quickCommand = activeProject ? `npm start | npx calmlogs --project "${activeProject.name}" --service "api"` : '';

  return (
    <div className="flex h-screen bg-[#fbfbfa] text-zinc-900 font-sans antialiased overflow-hidden selection:bg-zinc-200">
      {/* Sidebar Rail */}
      <Sidebar 
        projects={projects} 
        services={services} 
        activeProjectId={activeProjectId}
        activeServiceId={activeServiceId}
        currentUser={currentUser}
        currentUserRole={currentUserRole}
        activeOrgId={activeOrgId}
        activeOrgName={activeOrgName}
        onSelectService={(pId, sId) => {
          setActiveProjectId(pId);
          setActiveServiceId(sId);
        }}
        onProjectCreated={handleProjectCreated}
        onServiceCreated={handleServiceCreated}
        onProjectDeleted={handleProjectDeleted}
        onServiceDeleted={handleServiceDeleted}
        onSwitchWorkspace={() => setActiveOrgId(null)}
      />
      
      {/* Main Viewport */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#fbfbfa]">
        {activeProjectId && activeServiceId ? (
          <LogViewer
            projectId={activeProjectId}
            serviceId={activeServiceId}
            projectName={activeProject?.name}
            serviceName={activeService?.name}
            isWrite={isWrite}
            onServiceDeleted={handleServiceDeleted}
          />
        ) : projects.length === 0 ? (
          /* Empty Workspace State */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#fbfbfa]">
            <img src="/logo.png" alt="CalmLogs" className="w-14 h-14 object-contain rounded-2xl mb-5 shadow-sm" />
            <h2 className="text-xl font-bold font-sans tracking-tight text-zinc-900 mb-2">
              Welcome to CalmLogs
            </h2>
            <p className="text-xs text-zinc-500 font-mono max-w-sm mb-6 leading-relaxed">
              Stream logs live from your applications and services. Create a project to organize your services and start sending logs.
            </p>
            {isWrite ? (
              <button
                onClick={() => setShowCreateProject(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-sans text-xs font-semibold transition-all shadow-sm active:translate-y-[1px]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Project</span>
              </button>
            ) : (
              <div className="p-3 bg-zinc-100 rounded-lg text-zinc-600 text-xs font-mono">
                You have read-only access. An editor can create projects in this workspace.
              </div>
            )}
          </div>
        ) : activeProject && activeProjectServices.length === 0 ? (
          /* Project with No Services */
          <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-2xl mx-auto text-center font-mono">
            <div className="w-12 h-12 rounded-xl bg-white border border-zinc-200 flex items-center justify-center text-zinc-800 mb-4 shadow-sm">
              <Terminal className="w-5 h-5 text-sky-600" />
            </div>
            <h2 className="text-lg font-bold font-sans tracking-tight text-zinc-900 mb-1">
              Project: {activeProject.name}
            </h2>
            <p className="text-xs text-zinc-500 mb-6 font-mono">
              Ready for logs. Send your first event via HTTP or add a service.
            </p>

            {isWrite ? (
              <div className="flex items-center gap-3 mb-8">
                <button
                  onClick={() => setServiceModalTarget(activeProject)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 text-white text-xs font-sans font-semibold hover:bg-zinc-800 transition-colors shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Service
                </button>
                <button
                  onClick={() => handleSendTestLog(activeProject.name, "api")}
                  disabled={sendingTest}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-zinc-200 text-zinc-800 text-xs font-mono hover:bg-zinc-50 hover:text-zinc-950 transition-all shadow-xs disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{sendingTest ? "Sending Log..." : "Send Test Log"}</span>
                </button>
              </div>
            ) : (
              <div className="mb-6 p-2.5 bg-zinc-100 rounded-lg text-zinc-600 text-xs font-mono">
                Read-only access. You can view logs when services are active.
              </div>
            )}

            {/* 1-Command Stream Snippet */}
            <div className="w-full text-left bg-white text-zinc-900 rounded-xl p-4 shadow-sm border border-zinc-200 text-xs">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-100">
                <div className="flex items-center gap-2 text-zinc-700">
                  <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider font-mono">Stream With 1 Command (Zero Code)</span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(quickCommand);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors text-[11px] font-mono border border-zinc-200"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied" : "Copy Command"}</span>
                </button>
              </div>
              <pre className="overflow-x-auto whitespace-pre leading-relaxed text-zinc-700 font-mono text-[11px] bg-zinc-50 p-3 rounded-lg border border-zinc-200 select-all">
                {quickCommand}
              </pre>
              <p className="mt-2 text-[11px] text-zinc-400 font-sans">
                Pipes stdout from your service straight into CalmLogs. No code modifications needed.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 font-mono text-xs">
            <Activity className="w-8 h-8 mb-3 opacity-30" />
            <p>Select a service from the sidebar to view logs</p>
          </div>
        )}
      </main>

      <CreateProjectModal
        isOpen={showCreateProject}
        onClose={() => setShowCreateProject(false)}
        onCreated={handleProjectCreated}
      />

      {serviceModalTarget && (
        <CreateServiceModal
          isOpen={!!serviceModalTarget}
          projectId={serviceModalTarget.id}
          projectName={serviceModalTarget.name}
          onClose={() => setServiceModalTarget(null)}
          onCreated={handleServiceCreated}
        />
      )}

      {/* Review Invitation Modal */}
      {inviteModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900 text-sm font-sans">Workspace Invitation</h3>
                <p className="text-xs text-zinc-500 font-mono">You've been invited to join an organization</p>
              </div>
            </div>

            <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs space-y-2 font-mono">
              <div className="flex justify-between">
                <span className="text-zinc-500">Workspace:</span>
                <span className="font-semibold text-zinc-900 font-sans">{inviteModalData.orgName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Invited Role:</span>
                <span className="uppercase font-semibold text-emerald-700">{inviteModalData.role}</span>
              </div>
              {currentUser?.email && (
                <div className="flex justify-between border-t border-zinc-200/70 pt-1.5">
                  <span className="text-zinc-500">Google Account:</span>
                  <span className="text-zinc-800 font-medium truncate max-w-[200px]" title={currentUser.email}>{currentUser.email}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-zinc-600 font-sans leading-relaxed">
              Accepting will link your Google account to this workspace with <strong className="uppercase">{inviteModalData.role}</strong> permissions to view, search, and collaborate on logs.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={inviteActionLoading}
                onClick={handleRejectInvite}
                className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                Decline
              </button>
              <button
                type="button"
                disabled={inviteActionLoading}
                onClick={handleAcceptInvite}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold font-sans text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-all shadow-sm disabled:opacity-50"
              >
                {inviteActionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Accept Invitation</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
