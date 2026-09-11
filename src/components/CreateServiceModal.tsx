import React, { useState } from 'react';
import { X, Server, Loader2, Key, Eye, EyeOff, Copy, Check, Terminal, ShieldAlert, ArrowRight } from 'lucide-react';

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
  const [createdService, setCreatedService] = useState<any>(null);

  // Secret visibility & copy states
  const [showRawKey, setShowRawKey] = useState(false);
  const [showKeyInCmd, setShowKeyInCmd] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [cmdCopied, setCmdCopied] = useState(false);

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
      setCreatedService(newService);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    if (createdService) {
      onCreated(createdService);
    }
    onClose();
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const apiKey = createdService?.apiKey || '';
  const maskedKey = 'cl_live_' + '*'.repeat(32);

  // Real command to copy
  const realCurlCommand = `curl -X POST ${origin}/v1/logs \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"project": "${projectName}", "service": "${createdService?.name || name}", "level": "info", "message": "First log event"}'`;

  // Display command (can be masked or revealed)
  const displayCurlCommand = `curl -X POST ${origin}/v1/logs \\
  -H "Authorization: Bearer ${showKeyInCmd ? apiKey : maskedKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"project": "${projectName}", "service": "${createdService?.name || name}", "level": "info", "message": "First log event"}'`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-white text-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white">
              {createdService ? <Key className="w-4 h-4 text-emerald-400" /> : <Server className="w-4 h-4 text-sky-400" />}
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 text-sm font-sans">
                {createdService ? `Service Created: ${createdService.name}` : 'Add Service'}
              </h3>
              <p className="text-[10px] text-zinc-500 font-mono">
                Project: <span className="text-zinc-900 font-medium">{projectName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={createdService ? handleFinish : onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step 2: Show API Key & 1-Command Setup */}
        {createdService ? (
          <div className="p-6 space-y-4 font-mono">
            {/* Warning Alert */}
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2 text-xs text-amber-900 font-sans">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Save your API key now. For your security, this secret key will <strong>never be shown again</strong>.
              </p>
            </div>

            {/* Ingestion API Key Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider">
                  Ingestion API Key
                </span>
                <span className="text-[10px] text-zinc-400">Keep secret</span>
              </div>
              
              <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 border border-zinc-200 text-xs">
                <span className="font-mono text-zinc-800 flex-1 truncate select-all">
                  {showRawKey ? apiKey : maskedKey}
                </span>

                <button
                  type="button"
                  onClick={() => setShowRawKey(!showRawKey)}
                  title={showRawKey ? "Hide secret" : "View secret"}
                  className="p-1.5 rounded-md hover:bg-zinc-200/70 text-zinc-500 hover:text-zinc-800 transition-colors"
                >
                  {showRawKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(apiKey);
                    setKeyCopied(true);
                    setTimeout(() => setKeyCopied(false), 2000);
                  }}
                  title="Copy actual secret key"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-zinc-200 text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 text-[11px] font-sans font-medium transition-all shadow-2xs"
                >
                  {keyCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{keyCopied ? "Copied" : "Copy Key"}</span>
                </button>
              </div>
            </div>

            {/* 1-Command Quickstart */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-zinc-700">
                  <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">
                    Quickstart (1 Command)
                  </span>
                </div>
                
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowKeyInCmd(!showKeyInCmd)}
                    className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-800 font-sans px-1.5 py-0.5 rounded hover:bg-zinc-100 transition-colors"
                  >
                    {showKeyInCmd ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showKeyInCmd ? "Hide in command" : "View in command"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(realCurlCommand);
                      setCmdCopied(true);
                      setTimeout(() => setCmdCopied(false), 2000);
                    }}
                    title="Copy command with secret key"
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-800 transition-colors text-[10px] border border-zinc-200"
                  >
                    {cmdCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{cmdCopied ? "Copied!" : "Copy Command"}</span>
                  </button>
                </div>
              </div>

              <pre className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 text-[11px] font-mono text-zinc-700 overflow-x-auto leading-relaxed whitespace-pre select-all">
                {displayCurlCommand}
              </pre>
            </div>

            {/* Bottom Action */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleFinish}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold font-sans text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-all shadow-sm"
              >
                <span>Done & View Stream</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          /* Step 1: Create Service Form */
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
        )}
      </div>
    </div>
  );
}
