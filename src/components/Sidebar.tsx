import React from 'react';
import { Project, Service } from '../types';
import { LayoutGrid, Server, ChevronRight } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  projects: Project[];
  services: Service[];
  activeProjectId: string | null;
  activeServiceId: string | null;
  onSelectService: (projectId: string, serviceId: string) => void;
}

export default function Sidebar({ projects, services, activeProjectId, activeServiceId, onSelectService }: SidebarProps) {
  return (
    <aside className="w-64 flex-shrink-0 flex flex-col bg-[#FDFCFB] border-r border-zinc-200/60">
      <div className="h-14 flex items-center px-4 border-b border-zinc-200/60">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-zinc-900 flex items-center justify-center">
            <LayoutGrid className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-sm tracking-tight">CalmLogs</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4">
        {projects.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-zinc-500">No projects found.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {projects.map(project => (
              <div key={project.id} className="px-3">
                <h3 className="px-2 text-[11px] font-medium text-zinc-400 uppercase tracking-wider mb-2">
                  {project.name}
                </h3>
                <ul className="space-y-0.5">
                  {services.filter(s => s.project_id === project.id).map(service => {
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
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
