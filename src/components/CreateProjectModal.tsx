import React, { useState } from 'react';
import { X, FolderPlus, Loader2, Boxes, Layers, Copy, Check, Eye, EyeOff, Terminal, Network, ArrowRight } from 'lucide-react';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (project: any) => void;
}

export default function CreateProjectModal({ isOpen, onClose, onCreated }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectType, setProjectType] = useState<'standard' | 'compose'>('standard');
  const [composeNetwork, setComposeNetwork] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Post-creation compose setup state
  const [createdComposeData, setCreatedComposeData] = useState<{
    project: any;
    apiKey: string;
    composeNetwork?: string;
  } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const handleResetAndClose = () => {
    setName('');
    setDescription('');
    setProjectType('standard');
    setComposeNetwork('');
    setCreatedComposeData(null);
    setShowKey(false);
    setError('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setError('');
    setLoading(true);
    try {
      const isCompose = projectType === 'compose';
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: name.trim(), 
          description: description.trim(),
          isCompose,
          composeNetwork: composeNetwork.trim()
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create project');
      }

      const newProject = await res.json();
      
      if (isCompose && newProject.apiKey) {
        setCreatedComposeData({
          project: newProject,
          apiKey: newProject.apiKey,
          composeNetwork: composeNetwork.trim()
        });
      } else {
        onCreated(newProject);
        handleResetAndClose();
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleFinishCompose = () => {
    if (createdComposeData?.project) {
      onCreated(createdComposeData.project);
    }
    handleResetAndClose();
  };

  // If in Compose post-creation setup view
  if (createdComposeData) {
    const pName = createdComposeData.project.name;
    const key = createdComposeData.apiKey;
    const net = createdComposeData.composeNetwork;
    const maskedKey = showKey ? key : `${key.slice(0, 8)}••••••••••••••••••••••••••••`;

    const composeSnippet = `services:
  # Add to your docker-compose.yml:
  calmlogs:
    image: node:alpine
    container_name: calmlogs-forwarder
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
${net ? `    networks:\n      - ${net}\n` : '    # networks: [backend_net]  # Included if specified, or captures all services\n'}    command: >
      sh -c "apk add --no-cache docker-cli docker-cli-compose &&
      docker compose logs -f --no-color | npx -y calmlogs --project '${pName}' --key '${key}'"`;

    const hostCommand = `docker compose logs -f | npx calmlogs --project "${pName}" --key "${key}"`;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
        <div className="w-full max-w-2xl bg-white text-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white">
                <Boxes className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900 text-sm font-sans">Docker Compose Setup</h3>
                <p className="text-[10px] text-zinc-500 font-mono">Auto-resolves all services in {pName}</p>
              </div>
            </div>
            <button
              onClick={handleFinishCompose}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-5 font-mono text-xs">
            <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-emerald-800 text-[11px] leading-relaxed">
              <p className="font-semibold mb-0.5">Auto-Service Resolution Active</p>
              Containers in this stack (e.g. <span className="font-bold text-emerald-900">api</span>, <span className="font-bold text-emerald-900">postgres</span>, <span className="font-bold text-emerald-900">redis</span>, <span className="font-bold text-emerald-900">web</span>) will be automatically detected and mapped into distinct service tabs in CalmLogs.
            </div>

            {/* Ingestion Key */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-zinc-700 uppercase tracking-wider">
                  Project Ingestion Key
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-800 transition-colors"
                  >
                    {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showKey ? 'Hide Secret' : 'View Secret'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(key, 'key')}
                    className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-900 font-semibold"
                  >
                    {copiedSnippet === 'key' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSnippet === 'key' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
              <div className="p-2.5 bg-zinc-900 text-zinc-200 rounded-lg text-xs break-all font-mono select-all">
                {maskedKey}
              </div>
            </div>

            {/* Option A: Compose Service */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-zinc-500" />
                  Option 1: Add to docker-compose.yml
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(composeSnippet, 'compose')}
                  className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-900 font-semibold"
                >
                  {copiedSnippet === 'compose' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSnippet === 'compose' ? 'Copied YAML' : 'Copy YAML'}</span>
                </button>
              </div>
              <pre className="p-3 bg-zinc-900 text-zinc-200 rounded-xl text-[11px] font-mono overflow-x-auto leading-relaxed border border-zinc-800">
                {composeSnippet}
              </pre>
            </div>

            {/* Option B: Host Command */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                  Option 2: Run via Host Terminal
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(hostCommand, 'host')}
                  className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-900 font-semibold"
                >
                  {copiedSnippet === 'host' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSnippet === 'host' ? 'Copied Command' : 'Copy Command'}</span>
                </button>
              </div>
              <div className="p-2.5 bg-zinc-900 text-zinc-200 rounded-lg text-[11px] font-mono overflow-x-auto border border-zinc-800">
                {hostCommand}
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={handleFinishCompose}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold font-sans text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-all shadow-sm"
              >
                <span>Open Project in CalmLogs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-white text-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white">
              <FolderPlus className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 text-sm font-sans">Create Project</h3>
              <p className="text-[10px] text-zinc-500 font-mono">Groups your services and logs</p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
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
              Project Name *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. core-backend, production-stack, shop-app"
              className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 placeholder-zinc-400 outline-none focus:bg-white focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400/20 transition-all font-sans"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-1.5">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Infrastructure services and container logs"
              className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-800 placeholder-zinc-400 outline-none focus:bg-white focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400/20 transition-all font-sans"
            />
          </div>

          {/* Project Type Selection */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-2">
              Setup Architecture
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setProjectType('standard')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  projectType === 'standard'
                    ? 'border-zinc-900 bg-zinc-50/80 shadow-xs ring-1 ring-zinc-900/10'
                    : 'border-zinc-200 hover:border-zinc-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Layers className={`w-4 h-4 ${projectType === 'standard' ? 'text-zinc-900' : 'text-zinc-500'}`} />
                  <span className="text-xs font-semibold font-sans text-zinc-900">Standard Project</span>
                </div>
                <p className="text-[10px] text-zinc-500 font-mono leading-normal">
                  Individual services, microservices, and apps.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setProjectType('compose')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  projectType === 'compose'
                    ? 'border-zinc-900 bg-zinc-50/80 shadow-xs ring-1 ring-zinc-900/10'
                    : 'border-zinc-200 hover:border-zinc-300 bg-white'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Boxes className={`w-4 h-4 ${projectType === 'compose' ? 'text-emerald-600' : 'text-zinc-500'}`} />
                  <span className="text-xs font-semibold font-sans text-zinc-900">Docker Compose</span>
                </div>
                <p className="text-[10px] text-zinc-500 font-mono leading-normal">
                  Auto-maps all containers in your compose file.
                </p>
              </button>
            </div>
          </div>

          {/* Compose Network Options */}
          {projectType === 'compose' && (
            <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center gap-1.5 text-zinc-800 text-xs font-semibold font-sans">
                <Network className="w-3.5 h-3.5 text-zinc-600" />
                <span>Docker Network (Optional)</span>
              </div>
              <input
                type="text"
                value={composeNetwork}
                onChange={(e) => setComposeNetwork(e.target.value)}
                placeholder="e.g. backend_network (leave blank to log all services)"
                className="w-full px-3 py-1.5 text-xs bg-white border border-zinc-300 rounded-lg text-zinc-900 placeholder-zinc-400 outline-none focus:border-zinc-500 font-mono"
              />
              <p className="text-[10px] text-zinc-500 font-mono">
                Leave empty to forward logs from all services in the compose file, or enter a network name to limit capture.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={handleResetAndClose}
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
              <span>{projectType === 'compose' ? 'Create & Setup Compose' : 'Create Project'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
