import React, { useState } from 'react';
import { Project, Service } from '../types';
import { LayoutGrid, Server, ChevronRight, Plus, FolderPlus } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import CreateProjectModal from './CreateProjectModal';
import CreateServiceModal from './CreateServiceModal';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  projects: Project[];
  services: Service[];
  activeProjectId: string | null;
  activeServiceId: string | null;
  onSelectService: (projectId: string, serviceId: string) => void;
  onProjectCreated: (project: any) => void;
  onServiceCreated: (service: any) => void;
}

export default function Sidebar({
  projects,
  services,
  activeProjectId,
  activeServiceId,
  onSelectService,
  onProjectCreated,
  onServiceCreated
}: SidebarProps) {
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [serviceModalTarget, setServiceModalTarget] = useState<Project | null>(null);

  return (
    <>
      <aside className="w-64 flex-shrink-0 flex flex-col bg-[#FDFCFB] border-r border-zinc-200/60 h-full">
        <div className="h-14 flex items-center justify-between px-4 border-b border-zinc-200/60">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-zinc-900 flex items-center justify-center">
              <LayoutGrid className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-sm tracking-tight text-zinc-900">CalmLogs</span>
          </div>

          <button
            onClick={() => setShowCreateProject(true)}
            title="Create Project"
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-zinc-700 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200/70 rounded-md transition-colors border border-zinc-200/60"
          >
            <Plus className="w-3 h-3" />
            <span>New</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          <div className="px-4 mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Projects
            </span>
            <button
              onClick={() => setShowCreateProject(true)}
              title="Add Project"
              className="p-1 rounded text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="px-4 py-8 text-center flex flex-col items-center">
              <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-400 mb-2.5">
                <FolderPlus className="w-5 h-5" />
              </div>
              <p className="text-xs font-medium text-zinc-800">No projects yet</p>
              <p className="text-[11px] text-zinc-500 mt-1 mb-3 max-w-[180px]">
                Create your first project to start streaming logs.
              </p>
              <button
                onClick={() => setShowCreateProject(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium transition-colors shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Project
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {projects.map(project => {
                const projectServices = services.filter(s => s.project_id === project.id);
                return (
                  <div key={project.id} className="px-3">
                    <div className="flex items-center justify-between px-2 mb-1.5 group">
                      <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider truncate">
                        {project.name}
                      </h3>
                      <button
                        onClick={() => setServiceModalTarget(project)}
                        title={`Add service to ${project.name}`}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200/60 transition-opacity"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <ul className="space-y-0.5">
                      {projectServices.map(service => {
                        const isActive = activeProjectId === project.id && activeServiceId === service.id;
                        return (
                          <li key={service.id}>
                            <button
                              onClick={() => onSelectService(project.id, service.id)}
                              className={cn(
                                "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors",
                                isActive 
                                  ? "bg-zinc-100 text-zinc-900 font-medium" 
                                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
                              )}
                            >
                              <Server className={cn("w-3.5 h-3.5", isActive ? "text-zinc-900" : "text-zinc-400")} />
                              <span className="truncate">{service.name}</span>
                              {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto text-zinc-400" />}
                            </button>
                          </li>
                        );
                      })}

                      {projectServices.length === 0 && (
                        <li>
                          <button
                            onClick={() => setServiceModalTarget(project)}
                            className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100/60 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add service</span>
                          </button>
                        </li>
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      <CreateProjectModal
        isOpen={showCreateProject}
        onClose={() => setShowCreateProject(false)}
        onCreated={onProjectCreated}
      />

      {serviceModalTarget && (
        <CreateServiceModal
          isOpen={!!serviceModalTarget}
          projectId={serviceModalTarget.id}
          projectName={serviceModalTarget.name}
          onClose={() => setServiceModalTarget(null)}
          onCreated={onServiceCreated}
        />
      )}
    </>
  );
}
