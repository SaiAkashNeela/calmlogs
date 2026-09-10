import React, { useEffect, useState } from 'react';
import { authClient } from '../lib/auth-client';
import { Building, Plus, Check } from 'lucide-react';
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
    } catch(e) {}
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      const { data, error } = await authClient.organization.create({
        name: newOrgName,
        slug: newOrgSlug
      });
      if (data) {
        await handleSelect(data.id);
      }
    } catch(e) {}
    setCreateLoading(false);
  };

  const handleSelect = async (id: string) => {
    try {
      await authClient.organization.setActive({ organizationId: id });
      setActiveOrgId(id);
      onComplete();
    } catch(e) {}
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-zinc-50"><span className="text-zinc-500">Loading organizations...</span></div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-sm border border-zinc-100">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 bg-zinc-100 rounded-lg flex items-center justify-center mb-6 border border-zinc-200">
             <Building className="w-6 h-6 text-zinc-900" />
          </div>
          <h2 className="text-center text-3xl font-bold tracking-tight text-zinc-900">
            {showCreate || organizations.length === 0 ? 'Create organization' : 'Select organization'}
          </h2>
          <p className="mt-2 text-center text-sm text-zinc-600">
            {showCreate || organizations.length === 0 ? 'Set up a workspace for your team' : 'Choose a workspace to continue'}
          </p>
        </div>
        
        {(!showCreate && organizations.length > 0) ? (
          <div className="mt-8 space-y-3">
             {organizations.map(org => (
               <button
                 key={org.id}
                 onClick={() => handleSelect(org.id)}
                 className={cn(
                   "w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left",
                   activeOrgId === org.id 
                     ? "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900" 
                     : "border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50"
                 )}
               >
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded bg-white border border-zinc-200 flex items-center justify-center text-zinc-500 font-semibold text-lg">
                     {org.name.charAt(0).toUpperCase()}
                   </div>
                   <div>
                     <p className="font-semibold text-zinc-900">{org.name}</p>
                     <p className="text-xs text-zinc-500">{org.slug}</p>
                   </div>
                 </div>
                 {activeOrgId === org.id && <Check className="w-5 h-5 text-zinc-900" />}
               </button>
             ))}
             
             <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center gap-2 justify-center p-4 rounded-xl border border-dashed border-zinc-300 text-zinc-600 hover:text-zinc-900 hover:border-zinc-400 hover:bg-zinc-50 transition-all mt-4"
             >
               <Plus className="w-5 h-5" />
               <span className="font-medium">Create new organization</span>
             </button>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleCreate}>
            <div className="space-y-4 rounded-md">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Organization Name</label>
                <input
                  type="text"
                  required
                  className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 sm:text-sm"
                  placeholder="Acme Corp"
                  value={newOrgName}
                  onChange={(e) => {
                    setNewOrgName(e.target.value);
                    setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'));
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Organization Slug</label>
                <input
                  type="text"
                  required
                  className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 sm:text-sm"
                  placeholder="acme-corp"
                  value={newOrgSlug}
                  onChange={(e) => setNewOrgSlug(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3">
              {organizations.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 rounded-md bg-white px-3 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={createLoading}
                className="flex flex-1 justify-center rounded-md bg-zinc-900 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:opacity-50"
              >
                {createLoading ? 'Creating...' : 'Create Organization'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
