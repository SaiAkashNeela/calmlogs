import React, { useState } from 'react';
import { X, Server, Loader2, Key, Eye, EyeOff, Copy, Check, Terminal, ShieldAlert, ArrowRight, FolderGit2 } from 'lucide-react';

interface CreateServiceModalProps {
  isOpen: boolean;
  projectId: string;
  projectName: string;
  onClose: () => void;
  onCreated: (service: any) => void;
}

type StackType = 'node' | 'python' | 'go' | 'rust' | 'postgres' | 'redis' | 'docker' | 'compose' | 'frontend' | 'curl';

export default function CreateServiceModal({
  isOpen,
  projectId,
  projectName,
  onClose,
  onCreated
}: CreateServiceModalProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdService, setCreatedService] = useState<any>(null);

  // Active stack tab
  const [selectedStack, setSelectedStack] = useState<StackType>('node');

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
          name: name.trim()
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
  const activeKey = showKeyInCmd ? apiKey : maskedKey;
  const servName = createdService?.name || name;

  const stackSnippets: Record<StackType, { label: string; command: string; display: string; desc: string }> = {
    node: {
      label: 'Node.js',
      command: `npm start | npx calmlogs --project "${projectName}" --service "${servName}" --key "${apiKey}"`,
      display: `npm start | npx calmlogs --project "${projectName}" --service "${servName}" --key "${activeKey}"`,
      desc: 'Run in your Node / TypeScript project directory where you run npm start.'
    },
    python: {
      label: 'Python',
      command: `python main.py | npx calmlogs --project "${projectName}" --service "${servName}" --key "${apiKey}"`,
      display: `python main.py | npx calmlogs --project "${projectName}" --service "${servName}" --key "${activeKey}"`,
      desc: 'Run in your Python repo (works with FastAPI, Flask, Django, or scripts).'
    },
    go: {
      label: 'Go',
      command: `go run . | npx calmlogs --project "${projectName}" --service "${servName}" --key "${apiKey}"`,
      display: `go run . | npx calmlogs --project "${projectName}" --service "${servName}" --key "${activeKey}"`,
      desc: 'Run in your Go module directory where you start your server.'
    },
    rust: {
      label: 'Rust',
      command: `cargo run | npx calmlogs --project "${projectName}" --service "${servName}" --key "${apiKey}"`,
      display: `cargo run | npx calmlogs --project "${projectName}" --service "${servName}" --key "${activeKey}"`,
      desc: 'Run in your Cargo crate root directory.'
    },
    postgres: {
      label: 'PostgreSQL',
      command: `docker logs -f postgres | npx calmlogs --project "${projectName}" --service "${servName}" --key "${apiKey}"`,
      display: `docker logs -f postgres | npx calmlogs --project "${projectName}" --service "${servName}" --key "${activeKey}"`,
      desc: 'Stream live PostgreSQL query logs (Docker or tail -f /var/log/postgresql/*.log).'
    },
    redis: {
      label: 'Redis',
      command: `docker logs -f redis | npx calmlogs --project "${projectName}" --service "${servName}" --key "${apiKey}"`,
      display: `docker logs -f redis | npx calmlogs --project "${projectName}" --service "${servName}" --key "${activeKey}"`,
      desc: 'Stream live Redis commands and memory logs (Docker or tail -f /var/log/redis/*.log).'
    },
    docker: {
      label: 'Docker',
      command: `docker logs -f my-${servName} | npx calmlogs --project "${projectName}" --service "${servName}" --key "${apiKey}"`,
      display: `docker logs -f my-${servName} | npx calmlogs --project "${projectName}" --service "${servName}" --key "${activeKey}"`,
      desc: 'Pipe container logs live from your local terminal (works with any image).'
    },
    compose: {
      label: 'Docker Compose',
      command: `services:
  # Add this forwarder service to your docker-compose.yml:
  calmlogs:
    image: node:alpine
    container_name: calmlogs-forwarder
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    # networks: [backend_net]  # Included if specified, or captures all services
    command: >
      sh -c "apk add --no-cache docker-cli docker-cli-compose &&
      docker compose logs -f --no-color | npx -y calmlogs --project '${projectName}' --key '${apiKey}'"`,
      display: `services:
  # Add this forwarder service to your docker-compose.yml:
  calmlogs:
    image: node:alpine
    container_name: calmlogs-forwarder
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    # networks: [backend_net]  # Included if specified, or captures all services
    command: >
      sh -c "apk add --no-cache docker-cli docker-cli-compose &&
      docker compose logs -f --no-color | npx -y calmlogs --project '${projectName}' --key '${activeKey}'"`,
      desc: 'Drop-in compose service: automatically forwards logs for all containers in your compose stack.'
    },
    frontend: {
      label: 'Frontend',
      command: `// Add to index.html or root app component:
window.addEventListener('error', (e) => {
  fetch('${origin}/v1/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ${apiKey}' },
    body: JSON.stringify({ project: '${projectName}', service: '${servName}', level: 'error', message: e.message })
  });
});`,
      display: `// Add to index.html or root app component:
window.addEventListener('error', (e) => {
  fetch('${origin}/v1/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ${activeKey}' },
    body: JSON.stringify({ project: '${projectName}', service: '${servName}', level: 'error', message: e.message })
  });
});`,
      desc: 'Drop in React, Next.js client, Vue, or Vanilla JS to auto-capture errors live.'
    },
    curl: {
      label: 'cURL',
      command: `curl -X POST ${origin}/v1/logs \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"project": "${projectName}", "service": "${servName}", "level": "info", "message": "First test event"}'`,
      display: `curl -X POST ${origin}/v1/logs \\
  -H "Authorization: Bearer ${activeKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"project": "${projectName}", "service": "${servName}", "level": "info", "message": "First test event"}'`,
      desc: 'Send a quick test event directly from any terminal to verify the live stream.'
    }
  };

  const currentSnippet = stackSnippets[selectedStack];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-3xl sm:max-w-4xl bg-white text-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-zinc-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white">
              {createdService ? <Key className="w-4 h-4 text-emerald-400" /> : <Server className="w-4 h-4 text-sky-400" />}
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 text-sm font-sans">
                {createdService ? `Service Ready: ${createdService.name}` : 'Add Service'}
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

        {/* Step 2: Show API Key & Multi-Stack Setup */}
        {createdService ? (
          <div className="p-6 sm:p-7 space-y-5 font-mono">
            {/* Warning Alert */}
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900 font-sans">
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
              
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs">
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
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-white border border-zinc-200 text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 text-[11px] font-sans font-medium transition-all shadow-2xs"
                >
                  {keyCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{keyCopied ? "Copied" : "Copy Key"}</span>
                </button>
              </div>
            </div>

            {/* 1-Command Stack Quickstart */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 text-zinc-700">
                  <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider">
                    Where to Run (Project Terminal)
                  </span>
                </div>
                
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowKeyInCmd(!showKeyInCmd)}
                    className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-800 font-sans px-2 py-0.5 rounded hover:bg-zinc-100 transition-colors"
                  >
                    {showKeyInCmd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showKeyInCmd ? "Hide in code" : "View in code"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(currentSnippet.command);
                      setCmdCopied(true);
                      setTimeout(() => setCmdCopied(false), 2000);
                    }}
                    title="Copy command with real secret key"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-800 transition-colors text-[11px] font-medium border border-zinc-200"
                  >
                    {cmdCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{cmdCopied ? "Copied!" : "Copy Command"}</span>
                  </button>
                </div>
              </div>

              {/* Stack Tabs - Wrapped cleanly with no horizontal clipping */}
              <div className="flex flex-wrap items-center gap-1.5 bg-zinc-100 p-1 rounded-lg border border-zinc-200 text-[11px] font-mono">
                {(['node', 'python', 'go', 'rust', 'postgres', 'redis', 'docker', 'compose', 'frontend', 'curl'] as StackType[]).map(stack => (
                  <button
                    key={stack}
                    type="button"
                    onClick={() => setSelectedStack(stack)}
                    className={`px-3 py-1 rounded transition-all ${
                      selectedStack === stack 
                        ? 'bg-white text-zinc-950 font-semibold shadow-xs border border-zinc-200/80' 
                        : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/50'
                    }`}
                  >
                    {stackSnippets[stack].label}
                  </button>
                ))}
              </div>

              <pre className="p-3.5 rounded-lg bg-zinc-50 border border-zinc-200 text-[11px] font-mono text-zinc-800 leading-relaxed whitespace-pre-wrap break-all sm:break-normal select-all overflow-x-auto shadow-2xs">
                {currentSnippet.display}
              </pre>

              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-sans">
                <FolderGit2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span>{currentSnippet.desc}</span>
              </div>
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
          /* Step 1: Simple Service Creation Form */
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
                placeholder="e.g. api, redis, postgres, auth, worker, web"
                className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 placeholder-zinc-400 outline-none focus:bg-white focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400/20 transition-all font-sans"
              />
              <p className="mt-1.5 text-[10px] text-zinc-400 font-sans">
                Can be any service: your backend, database (postgres/redis), queue worker, or web frontend.
              </p>
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
