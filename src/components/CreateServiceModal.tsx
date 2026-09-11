import React, { useState } from 'react';
import { X, Server, Loader2 } from 'lucide-react';

interface CreateServiceModalProps {
  isOpen: boolean;
  projectId: string;
  projectName: string;
  onClose: () => void;
  onCreated: (service: any) => void;
}

export default function CreateServiceModal({
  isOpen,
  projectId,
  projectName,
  onClose,
  onCreated
}: CreateServiceModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState('api');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          name: name.trim(),
          type
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create service');
      }

      const newService = await res.json();
      setName('');
      onCreated(newService);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white text-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white">
              <Server className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 text-sm font-sans">Add Service</h3>
              <p className="text-[10px] text-zinc-500 font-mono">under project: <span className="text-zinc-900 font-medium">{projectName}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 font-mono">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
              Service Name *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. api, auth, worker, cron, payments"
              className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 placeholder-zinc-400 outline-none focus:bg-white focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400/20 transition-all font-sans"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
              Service Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-800 outline-none focus:bg-white focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400/20 transition-all"
            >
              <option value="api">API / HTTP Endpoint</option>
              <option value="worker">Background Worker / Queue</option>
              <option value="cron">Cron / Scheduled Job</option>
              <option value="database">Database / Cache Broker</option>
              <option value="frontend">Frontend Client</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold font-sans text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all shadow-sm"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Add Service
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
