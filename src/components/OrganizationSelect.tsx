import React, { useEffect, useState } from 'react';
import { authClient } from '../lib/auth-client';
import { Building, Plus, Check, Loader2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function OrganizationSelect({ onComplete }: { onComplete: () => void }) {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    fetchOrgs();
  }, []);

  const fetchOrgs = async () => {
    setLoading(true);
    try {
      const orgs = await authClient.organization.list({ query: {} } as any);
      const active = await authClient.organization.getFullOrganization({ query: {} } as any);
      setOrganizations(orgs.data || []);
      if (active.data?.id) {
        setActiveOrgId(active.data.id);
      }
    } catch (e) {}
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;

    setCreateLoading(true);
    try {
      const { data } = await authClient.organization.create({
        name: newOrgName.trim(),
        slug: newOrgSlug.trim() || newOrgName.trim().toLowerCase().replace(/[^a-z0-9]/g, '-')
      });
      if (data) {
        await handleSelect(data.id);
      }
    } catch (e) {}
    setCreateLoading(false);
  };

  const handleSelect = async (id: string) => {
    try {
      await authClient.organization.setActive({ organizationId: id });
      setActiveOrgId(id);
      onComplete();
    } catch (e) {}
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fbfbfa] text-zinc-500 font-mono text-xs">
        <Loader2 className="w-4 h-4 animate-spin text-zinc-500 mr-2" />
        <span>Loading workspaces...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fbfbfa] text-zinc-900 py-12 px-4 sm:px-6 lg:px-8 selection:bg-zinc-200">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-2xl border border-zinc-200 shadow-xl shadow-zinc-200/50">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center mb-4 border border-zinc-200 text-zinc-800">
            <Building className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-bold font-sans tracking-tight text-zinc-900">
            {showCreate || organizations.length === 0 ? 'Create Workspace' : 'Select Workspace'}
          </h2>
          <p className="mt-1 text-xs text-zinc-500 font-mono">
            {showCreate || organizations.length === 0 ? 'Set up an organization for your telemetry projects' : 'Choose an organization workspace to proceed'}
          </p>
        </div>
        
        {(!showCreate && organizations.length > 0) ? (
          <div className="mt-6 space-y-2.5">
            {organizations.map(org => (
              <button
                key={org.id}
                onClick={() => handleSelect(org.id)}
                className={cn(
                  "w-full flex items-center justify-between p-3.5 rounded-xl border transition-all text-left",
                  activeOrgId === org.id 
                    ? "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900 shadow-xs" 
                    : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/80"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-800 font-mono font-semibold text-sm">
                    {org.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-zinc-900 font-sans">{org.name}</p>
                    <p className="text-[11px] text-zinc-500 font-mono">{org.slug}</p>
                  </div>
                </div>
                {activeOrgId === org.id && <Check className="w-4 h-4 text-zinc-900" />}
              </button>
            ))}
            
            <button
              onClick={() => setShowCreate(true)}
              className="w-full flex items-center gap-2 justify-center p-3 rounded-xl border border-dashed border-zinc-300 text-zinc-600 hover:text-zinc-900 hover:border-zinc-400 hover:bg-zinc-50 transition-all text-xs font-mono mt-4"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Workspace</span>
            </button>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleCreate}>
            <div className="space-y-3 font-mono">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Workspace Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 focus:bg-white focus:ring-1 focus:ring-zinc-400/20 transition-all font-sans"
                  placeholder="e.g. Acme Production"
                  value={newOrgName}
                  onChange={(e) => {
                    setNewOrgName(e.target.value);
                    setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                  }}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
                  Workspace Slug
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 focus:bg-white focus:ring-1 focus:ring-zinc-400/20 transition-all"
                  placeholder="acme-prod"
                  value={newOrgSlug}
                  onChange={(e) => setNewOrgSlug(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-2 font-mono text-xs">
              {organizations.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 rounded-lg bg-zinc-100 border border-zinc-200 px-3 py-2.5 font-medium text-zinc-700 hover:bg-zinc-200 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={createLoading || !newOrgName.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3 py-2.5 font-sans font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                {createLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{createLoading ? 'Creating...' : 'Create Workspace'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
