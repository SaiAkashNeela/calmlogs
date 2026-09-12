import React, { useState, useEffect } from 'react';
import {
  Key,
  X,
  Trash2,
  RotateCcw,
  Plus,
  Copy,
  Check,
  Search,
  Loader2,
  AlertTriangle,
  Eye,
  EyeOff,
  Terminal,
  ShieldCheck,
  Layers,
  Server
} from 'lucide-react';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ApiKeyItem {
  service_id: string;
  service_name: string;
  service_type?: string;
  project_id: string;
  project_name: string;
  created_at: string;
  last_seen_at?: string;
  has_key: number | boolean;
}

interface ApiKeysModalProps {
  isOpen: boolean;
  activeOrgId: string | null;
  currentUserRole?: 'read' | 'write';
  initialServiceId?: string | null;
  onClose: () => void;
}

export default function ApiKeysModal({
  isOpen,
  activeOrgId,
  currentUserRole = 'read',
  initialServiceId,
  onClose
}: ApiKeysModalProps) {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Newly generated key banner
  const [newKeyData, setNewKeyData] = useState<{
    serviceId: string;
    serviceName: string;
    projectName: string;
    apiKey: string;
  } | null>(null);
  const [showRawNewKey, setShowRawNewKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Key to delete
  const [keyToDelete, setKeyToDelete] = useState<ApiKeyItem | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const isWrite = currentUserRole === 'write';

  const fetchKeys = async () => {
    if (!activeOrgId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/keys');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setKeys(data);
        }
      }
    } catch (e) {
      console.error('Failed to fetch API keys:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchKeys();
      setNewKeyData(null);
    }
  }, [isOpen, activeOrgId]);

  if (!isOpen) return null;

  const handleDeleteKey = async () => {
    if (!keyToDelete) return;
    setActionLoadingId(keyToDelete.service_id);
    try {
      const res = await fetch(`/api/keys?service_id=${keyToDelete.service_id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setKeys(prev =>
          prev.map(k =>
            k.service_id === keyToDelete.service_id ? { ...k, has_key: 0 } : k
          )
        );
        if (newKeyData?.serviceId === keyToDelete.service_id) {
          setNewKeyData(null);
        }
      }
    } catch (e) {
      console.error('Failed to delete key:', e);
    } finally {
      setActionLoadingId(null);
      setKeyToDelete(null);
    }
  };

  const handleGenerateOrRegenerate = async (item: ApiKeyItem) => {
    setActionLoadingId(item.service_id);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: item.service_id })
      });
      if (res.ok) {
        const data = await res.json();
        setKeys(prev =>
          prev.map(k =>
            k.service_id === item.service_id ? { ...k, has_key: 1 } : k
          )
        );
        setNewKeyData({
          serviceId: item.service_id,
          serviceName: data.service_name || item.service_name,
          projectName: data.project_name || item.project_name,
          apiKey: data.apiKey
        });
      }
    } catch (e) {
      console.error('Failed to generate key:', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredKeys = keys.filter(k => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      k.service_name.toLowerCase().includes(q) ||
      k.project_name.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/30 backdrop-blur-xs p-4 animate-in fade-in duration-100">
        <div className="bg-white rounded-xl border border-zinc-200 shadow-xl max-w-2xl w-full flex flex-col max-h-[85vh] font-sans text-xs overflow-hidden">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 bg-[#fbfbfa] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-700 shrink-0">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900 text-sm">API Keys</h3>
                <p className="text-zinc-500 font-mono text-[11px]">
                  Manage and delete ingestion API keys for your services
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Newly Generated Key Notice */}
          {newKeyData && (
            <div className="p-4 bg-emerald-50/70 border-b border-emerald-200/80 space-y-3 shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 text-emerald-800 font-semibold text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>
                    New API Key for {newKeyData.projectName} / {newKeyData.serviceName}
                  </span>
                </div>
                <button
                  onClick={() => setNewKeyData(null)}
                  className="text-emerald-700 hover:text-emerald-900 text-[11px] font-mono hover:underline"
                >
                  Dismiss
                </button>
              </div>
              <p className="text-[11px] text-emerald-700 font-mono">
                Save this key now. For your security, this key cannot be shown again in plaintext after you close this.
              </p>
              <div className="flex items-center gap-2 bg-white rounded-lg border border-emerald-300 p-2 font-mono">
                <span className="flex-1 text-zinc-900 font-semibold tracking-wide truncate select-all text-xs">
                  {showRawNewKey ? newKeyData.apiKey : 'cl_live_' + '•'.repeat(28)}
                </span>
                <button
                  type="button"
                  onClick={() => setShowRawNewKey(!showRawNewKey)}
                  title={showRawNewKey ? "Hide key" : "Show key"}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                >
                  {showRawNewKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(newKeyData.apiKey);
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] transition-colors shadow-2xs"
                >
                  {copiedKey ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Quick CLI example snippet */}
              <div className="bg-zinc-900 rounded-lg p-2.5 text-zinc-300 font-mono text-[10px] space-y-1">
                <div className="text-zinc-400 text-[9px] uppercase tracking-wider font-semibold">
                  Docker Compose Ingestion
                </div>
                <div className="text-zinc-200 select-all overflow-x-auto whitespace-pre">
                  {`docker compose logs -f --no-color | npx -y calmlogs --project '${newKeyData.projectName}' --key '${newKeyData.apiKey}'`}
                </div>
              </div>
            </div>
          )}

          {/* Search & Stats Bar */}
          <div className="px-5 py-2.5 border-b border-zinc-200 bg-white flex items-center justify-between gap-3 shrink-0">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by project or service..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1 text-xs font-mono bg-[#fbfbfa] border border-zinc-200 rounded-md text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 focus:bg-white transition-all"
              />
            </div>
            <span className="text-[11px] font-mono text-zinc-400">
              {filteredKeys.length} {filteredKeys.length === 1 ? 'service' : 'services'}
            </span>
          </div>

          {/* Key List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-400 font-mono text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                <span>Loading API keys...</span>
              </div>
            ) : filteredKeys.length === 0 ? (
              <div className="py-12 text-center text-zinc-400 font-mono text-xs">
                {searchQuery ? 'No services matched your search query.' : 'No services found in this workspace.'}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredKeys.map(item => {
                  const hasActiveKey = !!item.has_key;
                  const isHighlighted = initialServiceId === item.service_id;
                  const isLoadingAction = actionLoadingId === item.service_id;

                  return (
                    <div
                      key={item.service_id}
                      className={cn(
                        "p-3 rounded-lg border transition-all flex items-center justify-between gap-3",
                        isHighlighted
                          ? "bg-zinc-50/80 border-zinc-300 ring-1 ring-zinc-300"
                          : "bg-white border-zinc-200 hover:border-zinc-300"
                      )}
                    >
                      {/* Service & Project Info */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-7 h-7 rounded-md bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-600 shrink-0">
                          <Server className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-zinc-900 text-xs font-mono">
                              {item.service_name}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono">in</span>
                            <span className="text-[11px] text-zinc-600 font-mono font-medium truncate max-w-[140px]">
                              {item.project_name}
                            </span>
                            {item.service_type && (
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                                {item.service_type}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            {hasActiveKey ? (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Active Key
                                </span>
                                <span className="text-[10px] font-mono text-zinc-400 tracking-wider">
                                  cl_live_••••••••••••
                                </span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-100 text-zinc-500 border border-zinc-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                                Revoked / No Key
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      {isWrite && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {hasActiveKey ? (
                            <>
                              {/* Regenerate Key */}
                              <button
                                type="button"
                                disabled={isLoadingAction}
                                onClick={() => handleGenerateOrRegenerate(item)}
                                title={`Regenerate key for ${item.service_name}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-zinc-600 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 transition-colors font-mono text-[11px]"
                              >
                                {isLoadingAction ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <RotateCcw className="w-3 h-3" />
                                )}
                                <span className="hidden sm:inline">Regenerate</span>
                              </button>

                              {/* Delete / Revoke Key */}
                              <button
                                type="button"
                                disabled={isLoadingAction}
                                onClick={() => setKeyToDelete(item)}
                                title={`Delete and revoke key for ${item.service_name}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors font-mono text-[11px] font-medium"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete Key</span>
                              </button>
                            </>
                          ) : (
                            /* Generate new key */
                            <button
                              type="button"
                              disabled={isLoadingAction}
                              onClick={() => handleGenerateOrRegenerate(item)}
                              title={`Generate new key for ${item.service_name}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors font-mono text-[11px] font-medium"
                            >
                              {isLoadingAction ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Plus className="w-3 h-3" />
                              )}
                              <span>Generate Key</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-zinc-200 bg-[#fbfbfa] flex items-center justify-between shrink-0">
            <span className="text-[11px] text-zinc-400 font-mono">
              Keys are hashed with SHA-256 and never stored in plaintext.
            </span>
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs transition-colors font-mono"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation modal for deleting existing key */}
      <ConfirmDeleteModal
        isOpen={!!keyToDelete}
        title="Delete API Key"
        itemName={keyToDelete ? `${keyToDelete.service_name} API Key` : ''}
        description="Are you sure you want to delete and revoke this key? Any services or log forwarders sending logs with this key will immediately be rejected."
        onConfirm={handleDeleteKey}
        onClose={() => setKeyToDelete(null)}
      />
    </>
  );
}
