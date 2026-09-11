import { useState, useEffect, useCallback } from 'react';
import { Project, Service } from './types';
import Sidebar from './components/Sidebar';
import LogViewer from './components/LogViewer';
import AuthScreen from './components/AuthScreen';
import OrganizationSelect from './components/OrganizationSelect';
import CreateProjectModal from './components/CreateProjectModal';
import CreateServiceModal from './components/CreateServiceModal';
import { authClient } from './lib/auth-client';
import { Activity, LogOut, Plus, FolderPlus, Terminal, Copy, Check, Send } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeServiceId, setActiveServiceId] = useState<string | null>(null);

  const [showCreateProject, setShowCreateProject] = useState(false);
  const [serviceModalTarget, setServiceModalTarget] = useState<Project | null>(null);
  const [copied, setCopied] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const checkSession = async () => {
    try {
      const res = await authClient.getSession({ query: {} } as any);
      setSession(res.data?.session);
      if (res.data?.session?.activeOrganizationId) {
        setActiveOrgId(res.data.session.activeOrganizationId);
      }
    } catch(e) {}
    setLoading(false);
  };

  useEffect(() => {
    checkSession();
  }, []);

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

  // When active project changes, update default active service if needed
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
    setActiveProjectId(newProject.id);
    setActiveServiceId(null);
  };

  const handleServiceCreated = async (newService: any) => {
    await loadServices();
    setActiveProjectId(newService.project_id);
    setActiveServiceId(newService.id);
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
          event: 'system.welcome',
          message: `CalmLogs initialized for ${projName}/${serviceName}`,
          timestamp: new Date().toISOString(),
          metadata: { env: 'development', host: 'localhost' }
        })
      });

      const updatedServices = await loadServices();
      const createdServ = updatedServices.find((s: any) => s.project_id === activeProjectId && s.name === serviceName);
      if (createdServ) {
        setActiveServiceId(createdServ.id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-zinc-50 flex items-center justify-center text-zinc-500">Loading...</div>;

  if (!session) {
    return <AuthScreen onLogin={checkSession} />;
  }

  if (!activeOrgId) {
    return <OrganizationSelect onComplete={checkSession} />;
  }

  const activeProject = projects.find(p => p.id === activeProjectId);
  const activeProjectServices = activeProjectId ? services.filter(s => s.project_id === activeProjectId) : [];

  const curlExample = activeProject ? `curl -X POST http://localhost:3000/v1/logs \\
  -H "Content-Type: application/json" \\
  -d '{
    "project": "${activeProject.name}",
    "service": "api",
    "level": "info",
    "event": "user.login",
    "message": "User authenticated successfully"
  }'` : '';

  return (
    <div className="flex h-screen bg-[#FDFCFB] text-zinc-900 font-sans antialiased overflow-hidden selection:bg-zinc-200">
      <div className="flex flex-col border-r border-zinc-200/60 bg-[#FDFCFB]">
        <Sidebar 
          projects={projects} 
          services={services} 
          activeProjectId={activeProjectId}
          activeServiceId={activeServiceId}
          onSelectService={(pId, sId) => {
            setActiveProjectId(pId);
            setActiveServiceId(sId);
          }}
          onProjectCreated={handleProjectCreated}
          onServiceCreated={handleServiceCreated}
        />
        <div className="p-4 mt-auto border-t border-zinc-200/60">
          <button 
            onClick={async () => {
              await authClient.signOut({} as any);
              window.location.reload();
            }}
            className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 w-full px-2 py-1.5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
      
      <main className="flex-1 flex flex-col min-w-0 bg-white">
        {activeProjectId && activeServiceId ? (
          <LogViewer projectId={activeProjectId} serviceId={activeServiceId} />
        ) : projects.length === 0 ? (
          /* Empty state: No projects created yet */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-zinc-50/50">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 flex items-center justify-center text-white mb-6 shadow-sm">
              <FolderPlus className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 mb-2">
              Welcome to CalmLogs
            </h2>
            <p className="text-sm text-zinc-500 max-w-md mb-8">
              Start monitoring your systems with real-time log streaming. Create your first project to organize your microservices and APIs.
            </p>
            <button
              onClick={() => setShowCreateProject(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Create Your First Project
            </button>
          </div>
        ) : activeProject && activeProjectServices.length === 0 ? (
          /* Empty state: Project exists but has no services */
          <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-2xl mx-auto text-center">
            <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-700 mb-4 border border-zinc-200">
              <Activity className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 mb-1">
              Project: {activeProject.name}
            </h2>
            <p className="text-sm text-zinc-500 mb-6">
              No services found in this project yet. Add a service or ingest your first log to start streaming.
            </p>

            <div className="flex items-center gap-3 mb-8">
              <button
                onClick={() => setServiceModalTarget(activeProject)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4" />
                Add Service
              </button>
              <button
                onClick={() => handleSendTestLog(activeProject.name, "api")}
                disabled={sendingTest}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-zinc-200 text-zinc-800 text-sm font-medium hover:bg-zinc-50 hover:border-zinc-300 transition-all shadow-xs disabled:opacity-50"
              >
                <Send className="w-4 h-4 text-emerald-600" />
                {sendingTest ? "Sending Log..." : "Send Test Log"}
              </button>
            </div>

            {/* Quick Ingestion Guide */}
            <div className="w-full text-left bg-zinc-900 text-zinc-100 rounded-xl p-4 shadow-sm border border-zinc-800 font-mono text-xs">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Send logs via HTTP</span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(curlExample);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <pre className="overflow-x-auto whitespace-pre leading-relaxed text-zinc-300">
                {curlExample}
              </pre>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-400">
            <Activity className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm">Select a service from the sidebar to view live logs</p>
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
    </div>
  );
}

