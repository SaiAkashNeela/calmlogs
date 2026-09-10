import { useState, useEffect } from 'react';
import { Project, Service, LogEvent } from './types';
import Sidebar from './components/Sidebar';
import LogViewer from './components/LogViewer';
import AuthScreen from './components/AuthScreen';
import OrganizationSelect from './components/OrganizationSelect';
import { authClient } from './lib/auth-client';
import { Activity, LogOut } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeServiceId, setActiveServiceId] = useState<string | null>(null);

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

  useEffect(() => {
    if (activeOrgId) {
      fetch('/api/projects')
        .then(r => r.json())
        .then(data => {
          setProjects(data);
          if (data.length > 0) setActiveProjectId(data[0].id);
        });
        
      fetch('/api/services')
        .then(r => r.json())
        .then(data => {
          setServices(data);
        });
    }
  }, [activeOrgId]);

  if (loading) return <div className="min-h-screen bg-zinc-50 flex items-center justify-center text-zinc-500">Loading...</div>;

  if (!session) {
    return <AuthScreen onLogin={checkSession} />;
  }

  if (!activeOrgId) {
    return <OrganizationSelect onComplete={checkSession} />;
  }

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
        />
        <div className="p-4 mt-auto border-t border-zinc-200/60">
          <button 
            onClick={async () => {
              await authClient.signOut({} as any);
              window.location.reload();
            }}
            className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 w-full px-2 py-1.5"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
      
      <main className="flex-1 flex flex-col min-w-0 bg-white">
        {activeProjectId && activeServiceId ? (
          <LogViewer projectId={activeProjectId} serviceId={activeServiceId} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-400">
            <Activity className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm">Select a service to view logs</p>
          </div>
        )}
      </main>
    </div>
  );
}
