import React, { useState, useRef, useEffect } from 'react';
import { Project, Service } from '../types';
import {
  Server,
  ChevronRight,
  Plus,
  FolderPlus,
  Layers,
  LogOut,
  HelpCircle,
  Trash2,
  Building,
  ChevronUp,
  UserCheck,
  Users
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import CreateProjectModal from './CreateProjectModal';
import CreateServiceModal from './CreateServiceModal';
import FeedbackModal from './FeedbackModal';
import DeleteAccountModal from './DeleteAccountModal';
import MembersModal from './MembersModal';
import { authClient } from '../lib/auth-client';
import { useCachedAvatar } from '../lib/avatar-cache';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  projects: Project[];
  services: Service[];
  activeProjectId: string | null;
  activeServiceId: string | null;
  currentUser?: any;
  currentUserRole?: 'read' | 'write';
  activeOrgId?: string | null;
  activeOrgName?: string;
  onSelectService: (projectId: string, serviceId: string) => void;
  onProjectCreated: (project: any) => void;
  onServiceCreated: (service: any) => void;
  onSwitchWorkspace: () => void;
}

export default function Sidebar({
  projects,
  services,
  activeProjectId,
  activeServiceId,
  currentUser,
  currentUserRole = 'read',
  activeOrgId,
  activeOrgName,
  onSelectService,
  onProjectCreated,
  onServiceCreated,
  onSwitchWorkspace
}: SidebarProps) {
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [serviceModalTarget, setServiceModalTarget] = useState<Project | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close profile menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileMenu]);

  const handleSignOut = async () => {
    await authClient.signOut({} as any);
    window.location.reload();
  };

  const userInitial = currentUser?.name?.charAt(0) || currentUser?.email?.charAt(0) || 'U';
  const isWrite = currentUserRole === 'write';
  const cachedAvatarUrl = useCachedAvatar(currentUser?.image);

  return (
    <>
      <aside className="w-64 flex-shrink-0 flex flex-col bg-[#fbfbfa] border-r border-zinc-200/80 h-full text-zinc-700 font-mono select-none">
        {/* Brand / Header */}
        <div className="h-13 flex items-center justify-between px-3.5 border-b border-zinc-200 bg-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/logo.png" alt="CalmLogs" className="w-6 h-6 object-contain rounded-md shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-xs tracking-tight text-zinc-900 font-sans">CalmLogs</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-500 font-mono truncate max-w-[80px]">
                  {activeOrgName || 'Workspace'}
                </span>
                <span
                  className={cn(
                    "text-[9px] font-mono font-semibold uppercase px-1 py-0.2 rounded border",
                    isWrite
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-zinc-100 text-zinc-600 border-zinc-200"
                  )}
                >
                  {currentUserRole}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowMembersModal(true)}
              title="Members & Invitations"
              className="p-1 rounded text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors border border-transparent hover:border-zinc-200"
            >
              <Users className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        
        {/* Project & Service Explorer */}
        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          <div className="px-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
              Projects ({projects.length})
            </span>
            {isWrite && projects.length > 0 && (
              <button
                onClick={() => setShowCreateProject(true)}
                title="Add Project"
                className="p-1 rounded text-zinc-400 hover:text-zinc-800 hover:bg-zinc-200/60 transition-colors"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>

          {projects.length === 0 ? (
            <div className="px-3 py-6 text-center text-zinc-400 text-[11px] font-mono">
              No projects yet
            </div>
          ) : (
            <div className="space-y-4">
              {projects.map(project => {
                const projectServices = services.filter(s => s.project_id === project.id);
                return (
                  <div key={project.id} className="space-y-1">
                    <div className="flex items-center justify-between px-2 py-1 rounded group hover:bg-zinc-200/40 transition-colors">
                      <div className="flex items-center gap-2 truncate">
                        <Layers className="w-3 h-3 text-zinc-400 shrink-0" />
                        <h3 className="text-xs font-medium text-zinc-800 truncate font-mono" title={project.name}>
                          {project.name}
                        </h3>
                      </div>
                      {isWrite && (
                        <button
                          onClick={() => setServiceModalTarget(project)}
                          title={`Add service to ${project.name}`}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200 transition-all"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <ul className="space-y-0.5 pl-3 border-l border-zinc-200/80 ml-3">
                      {projectServices.map(service => {
                        const isActive = activeProjectId === project.id && activeServiceId === service.id;
                        return (
                          <li key={service.id}>
                            <button
                              onClick={() => onSelectService(project.id, service.id)}
                              className={cn(
                                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all text-left font-mono",
                                isActive 
                                  ? "bg-white text-zinc-950 font-semibold border border-zinc-200 shadow-2xs" 
                                  : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/40"
                              )}
                            >
                              <span className={cn(
                                "w-1.5 h-1.5 rounded-full shrink-0",
                                isActive ? "bg-emerald-500" : "bg-zinc-300"
                              )} />
                              <span className="truncate flex-1">{service.name}</span>
                              {isActive && <ChevronRight className="w-3 h-3 text-zinc-400 shrink-0" />}
                            </button>
                          </li>
                        );
                      })}

                      {projectServices.length === 0 && (
                        <li className="px-2 py-1">
                          {isWrite ? (
                            <button
                              onClick={() => setServiceModalTarget(project)}
                              className="w-full flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/40 transition-colors font-mono"
                            >
                              <Plus className="w-2.5 h-2.5" />
                              <span>Add service</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-zinc-400 font-mono italic">No services</span>
                          )}
                        </li>
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* User Profile & Logout Footer */}
        <div className="relative p-2.5 border-t border-zinc-200 bg-white shrink-0">
          <div className="flex items-center justify-between gap-2">
            {/* Profile trigger button */}
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex-1 flex items-center gap-2 p-1.5 rounded-lg hover:bg-zinc-100 transition-colors text-left min-w-0"
              title="Account & Settings"
            >
              {cachedAvatarUrl ? (
                <img
                  src={cachedAvatarUrl}
                  alt={currentUser.name || 'User'}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover border border-zinc-200 shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-zinc-900 text-white font-sans font-semibold text-xs flex items-center justify-center shrink-0">
                  {userInitial.toUpperCase()}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-semibold text-zinc-900 font-sans truncate">
                  {currentUser?.name || 'My Account'}
                </span>
                <span className="text-[10px] text-zinc-500 truncate font-mono">
                  {currentUser?.email || 'Logged in'}
                </span>
              </div>
              <ChevronUp className="w-3.5 h-3.5 text-zinc-400 ml-auto shrink-0" />
            </button>
          </div>

          {/* Profile Dropdown Popover */}
          {showProfileMenu && (
            <div
              ref={menuRef}
              className="absolute bottom-full left-2 right-2 mb-1 bg-white rounded-xl shadow-xl border border-zinc-200 p-1.5 space-y-1 font-sans text-xs z-50 animate-in fade-in zoom-in-95 duration-150"
            >
              {/* Account header */}
              <div className="px-2.5 py-2 border-b border-zinc-100 mb-1">
                <div className="flex items-center gap-1.5 text-[10px] font-mono font-medium text-emerald-600 mb-0.5">
                  <UserCheck className="w-3 h-3" />
                  <span>Google Account</span>
                </div>
                <p className="font-semibold text-zinc-900 truncate">{currentUser?.name}</p>
                <p className="text-[11px] text-zinc-500 font-mono truncate">{currentUser?.email}</p>
              </div>

              {/* Action buttons */}
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  setShowMembersModal(true);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 transition-colors text-left"
              >
                <Users className="w-3.5 h-3.5 text-zinc-500" />
                <span>Members & Invites</span>
              </button>

              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  onSwitchWorkspace();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 transition-colors text-left"
              >
                <Building className="w-3.5 h-3.5 text-zinc-500" />
                <span>Switch Workspace</span>
              </button>

              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  setShowFeedback(true);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 transition-colors text-left"
              >
                <HelpCircle className="w-3.5 h-3.5 text-sky-600" />
                <span>Feedback & Help</span>
              </button>

              <div className="border-t border-zinc-100 my-1" />

              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  setShowDeleteAccount(true);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors text-left font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Account</span>
              </button>

              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 transition-colors text-left font-medium"
              >
                <LogOut className="w-3.5 h-3.5 text-zinc-500" />
                <span>Log Out</span>
              </button>
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

      <MembersModal
        isOpen={showMembersModal}
        activeOrgId={activeOrgId || null}
        currentUserRole={currentUserRole}
        currentUserEmail={currentUser?.email}
        onClose={() => setShowMembersModal(false)}
      />

      <FeedbackModal
        isOpen={showFeedback}
        userEmail={currentUser?.email}
        onClose={() => setShowFeedback(false)}
      />

      <DeleteAccountModal
        isOpen={showDeleteAccount}
        userEmail={currentUser?.email}
        onClose={() => setShowDeleteAccount(false)}
      />
    </>
  );
}
