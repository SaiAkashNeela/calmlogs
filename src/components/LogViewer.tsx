import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { LogEvent, LogLevel } from '../types';
import { format } from 'date-fns';
import {
  WifiOff,
  Loader2,
  Search,
  X,
  Copy,
  Check,
  Pause,
  Play,
  Trash2,
  BrushCleaning,
  Download,
  ArrowDown,
  Activity,
  BarChart2,
  PieChart,
  TrendingUp,
  Key
} from 'lucide-react';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import ApiKeysModal from './ApiKeysModal';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ConnectionState = 'CONNECTING' | 'LIVE' | 'RECONNECTING' | 'DISCONNECTED';

interface LogViewerProps {
  projectId: string;
  serviceId: string;
  projectName?: string;
  serviceName?: string;
  isWrite?: boolean;
  activeOrgId?: string | null;
  onServiceDeleted?: (serviceId: string) => void;
}

export default function LogViewer({
  projectId,
  serviceId,
  projectName,
  serviceName,
  isWrite = true,
  activeOrgId,
  onServiceDeleted
}: LogViewerProps) {
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('CONNECTING');
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedLog, setSelectedLog] = useState<LogEvent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLevels, setActiveLevels] = useState<Set<LogLevel>>(new Set(['debug', 'info', 'warn', 'error']));
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteServiceModal, setShowDeleteServiceModal] = useState(false);
  const [showApiKeysModal, setShowApiKeysModal] = useState(false);
  const [showCharts, setShowCharts] = useState(true);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const streamContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const isPausedRef = useRef(isPaused);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Keyboard shortcut listener (/ to search, Esc to close drawer/clear search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape') {
        if (selectedLog) {
          setSelectedLog(null);
        } else if (searchQuery) {
          setSearchQuery('');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLog, searchQuery]);

  const fetchHistorical = useCallback(async () => {
    try {
      const res = await fetch(`/api/historical?project_id=${projectId}&service_id=${serviceId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          data.sort((a: LogEvent, b: LogEvent) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          setLogs(data);
        }
      }
    } catch (e) {
      console.error("Failed to fetch historical logs", e);
    }
  }, [projectId, serviceId]);

  const connectWs = useCallback(() => {
    setConnectionState(prev => prev === 'LIVE' ? 'LIVE' : 'CONNECTING');
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?project_id=${projectId}&service_id=${serviceId}`;
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionState('LIVE');
      };

      ws.onmessage = (event) => {
        try {
          const log: LogEvent = JSON.parse(event.data);
          if (!isPausedRef.current) {
            setLogs(prev => [...prev, log].slice(-1500));
          }
        } catch (e) {}
      };

      ws.onclose = () => {
        setConnectionState('DISCONNECTED');
        reconnectTimeoutRef.current = setTimeout(() => {
          setConnectionState('RECONNECTING');
          connectWs();
        }, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (err) {
      setConnectionState('DISCONNECTED');
    }
  }, [projectId, serviceId]);

  useEffect(() => {
    setLogs([]);
    setSelectedLog(null);
    fetchHistorical().then(() => {
      connectWs();
    });

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [projectId, serviceId, fetchHistorical, connectWs]);

  // Scroll handling: auto-scroll to bottom like standard terminal
  useEffect(() => {
    if (autoScroll && streamContainerRef.current) {
      requestAnimationFrame(() => {
        if (streamContainerRef.current) {
          streamContainerRef.current.scrollTop = streamContainerRef.current.scrollHeight;
        }
      });
    }
  }, [filteredLogs, autoScroll]);

  const handleScroll = () => {
    if (!streamContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = streamContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 30;
    // When user scrolls up away from bottom, gently pause autoScroll so screen doesn't jump
    if (!isAtBottom && autoScroll) {
      setAutoScroll(false);
    }
  };

  const handleToggleAutoScroll = () => {
    setAutoScroll(prev => {
      const next = !prev;
      if (next && streamContainerRef.current) {
        requestAnimationFrame(() => {
          if (streamContainerRef.current) {
            streamContainerRef.current.scrollTop = streamContainerRef.current.scrollHeight;
          }
        });
      }
      return next;
    });
  };

  const filteredLogs = logs.filter(l => {
    const levelMatch = activeLevels.has(l.level);
    if (!levelMatch) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (l.message && l.message.toLowerCase().includes(query)) ||
      (l.event && l.event.toLowerCase().includes(query)) ||
      (l.request_id && l.request_id.toLowerCase().includes(query)) ||
      (l.trace_id && l.trace_id.toLowerCase().includes(query))
    );
  });

  const levelCounts = logs.reduce<Record<LogLevel, number>>(
    (acc, l) => {
      acc[l.level] = (acc[l.level] || 0) + 1;
      return acc;
    },
    { debug: 0, info: 0, warn: 0, error: 0 }
  );

  const handleExport = () => {
    const jsonl = filteredLogs.map(l => JSON.stringify(l)).join('\n');
    const blob = new Blob([jsonl], { type: 'application/x-jsonlines' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const pTag = (projectName || projectId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const sTag = (serviceName || serviceId).replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `calmlogs-${pTag}-${sTag}-${Date.now()}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    setLogs([]);
    setSelectedLog(null);
  };

  const handleDeleteService = async () => {
    try {
      const res = await fetch(`/api/services?id=${serviceId}`, { method: 'DELETE' });
      if (res.ok && onServiceDeleted) {
        onServiceDeleted(serviceId);
      }
    } catch (e) {
      console.error("Failed to delete service", e);
    }
  };

  return (
    <div className="flex flex-1 h-full overflow-hidden bg-white text-zinc-900 selection:bg-zinc-200">
      {/* Main Console Area */}
      <div className={cn("flex flex-col flex-1 min-w-0 transition-all", selectedLog ? "w-3/5 border-r border-zinc-200" : "w-full")}>
        
        {/* Workbench Control Bar */}
        <div className="h-13 px-4 flex items-center justify-between border-b border-zinc-200 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-zinc-900 uppercase tracking-wider">
                Live Stream
              </span>
              {(projectName || serviceName) && (
                <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                  <span className="font-semibold text-zinc-900">{projectName || projectId}</span>
                  <span className="text-zinc-400">/</span>
                  <span className="text-zinc-700">{serviceName || serviceId}</span>
                </div>
              )}
              <ConnectionStatusBadge state={connectionState} isPaused={isPaused} />
            </div>

            <div className="h-4 w-px bg-zinc-200 mx-1 hidden sm:block" />

            {/* Log Level Filters */}
            <div className="flex items-center gap-1 bg-zinc-100 p-0.5 rounded-lg border border-zinc-200">
              {(['debug', 'info', 'warn', 'error'] as LogLevel[]).map(level => {
                const isActive = activeLevels.has(level);
                const count = levelCounts[level] || 0;
                return (
                  <button
                    key={level}
                    onClick={() => {
                      setActiveLevels(prev => {
                        const next = new Set(prev);
                        if (next.has(level)) next.delete(level);
                        else next.add(level);
                        return next;
                      });
                    }}
                    className={cn(
                      "px-2 py-0.5 text-[11px] font-mono font-medium rounded transition-all flex items-center gap-1.5",
                      isActive
                        ? level === 'error'
                          ? "bg-rose-50 text-rose-700 border border-rose-200 shadow-xs"
                          : level === 'warn'
                          ? "bg-amber-50 text-amber-800 border border-amber-200 shadow-xs"
                          : level === 'info'
                          ? "bg-sky-50 text-sky-700 border border-sky-200 shadow-xs"
                          : "bg-white text-zinc-900 border border-zinc-200 shadow-xs"
                        : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/50 border border-transparent"
                    )}
                  >
                    <span className="uppercase">{level}</span>
                    <span className="opacity-60 text-[10px]">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Pause/Resume button */}
            <button
              onClick={() => setIsPaused(!isPaused)}
              title={isPaused ? "Resume live stream" : "Pause live stream"}
              className={cn(
                "p-1.5 rounded-md text-xs font-medium border transition-colors flex items-center gap-1",
                isPaused
                  ? "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
                  : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950"
              )}
            >
              {isPaused ? <Play className="w-3.5 h-3.5 text-amber-700" /> : <Pause className="w-3.5 h-3.5" />}
            </button>

            {/* Clear logs with cleaning brush icon and confirmation */}
            {showClearConfirm ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-300 rounded-md text-[11px] font-mono shadow-xs animate-in fade-in zoom-in-95 duration-150">
                <BrushCleaning className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="text-amber-900 font-semibold">
                  {logs.length > 0 ? `Clear ${logs.length} logs?` : "Clear log buffer?"}
                </span>
                <button
                  onClick={() => {
                    handleClear();
                    setShowClearConfirm(false);
                  }}
                  className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium text-[10px] transition-colors shadow-2xs cursor-pointer"
                >
                  Yes, Clear
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-1.5 py-0.5 text-zinc-600 hover:text-zinc-900 hover:bg-amber-100/60 rounded text-[10px] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                title="Clear current log buffer"
                className="p-1.5 rounded-md bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                <BrushCleaning className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Toggle Charts / Metrics */}
            <button
              onClick={() => setShowCharts(!showCharts)}
              title={showCharts ? "Hide metrics charts" : "Show metrics charts"}
              className={cn(
                "p-1.5 rounded-md text-xs font-mono font-medium border transition-colors flex items-center gap-1",
                showCharts
                  ? "bg-zinc-100 border-zinc-300 text-zinc-900"
                  : "bg-white border-zinc-200 text-zinc-500 hover:text-zinc-950 hover:bg-zinc-50"
              )}
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>

            {/* Export JSONL */}
            <button
              onClick={handleExport}
              title="Export filtered logs as JSONL"
              className="p-1.5 rounded-md bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {/* API Key Management */}
            <button
              onClick={() => setShowApiKeysModal(true)}
              title={`API Key for ${serviceName || serviceId}`}
              className="p-1.5 rounded-md bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50 transition-colors flex items-center gap-1 text-xs font-mono"
            >
              <Key className="w-3.5 h-3.5 text-zinc-500" />
              <span className="hidden sm:inline">API Key</span>
            </button>

            {/* Delete Service Button in Top Right */}
            {isWrite && (
              <>
                <div className="h-4 w-px bg-zinc-200 mx-0.5" />
                <button
                  onClick={() => setShowDeleteServiceModal(true)}
                  title={`Delete service ${serviceName || serviceId}`}
                  className="p-1.5 rounded-md bg-white border border-zinc-200 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Dedicated Query / Search Bar Below */}
        <div className="h-10 px-4 flex items-center justify-between border-b border-zinc-200 bg-[#fbfbfa] shrink-0 font-mono text-xs">
          <div className="relative flex-1 flex items-center max-w-xl">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Query logs (filter by message, event, request/trace ID)...  press '/' to focus"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-1 text-xs font-mono bg-white border border-zinc-200 rounded-md text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400/20 transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                title="Clear query"
                className="absolute right-2 text-zinc-400 hover:text-zinc-700 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-zinc-500 shrink-0 ml-3">
            {searchQuery ? (
              <span className="bg-zinc-200/80 text-zinc-700 px-2 py-0.5 rounded text-[10px] font-medium">
                {filteredLogs.length} of {logs.length} matching
              </span>
            ) : (
              <span className="text-zinc-400 text-[10px]">
                {logs.length} buffered
              </span>
            )}
          </div>
        </div>

        {/* Visual Charts & Metrics Strip */}
        {showCharts && logs.length > 0 && (
          <ServiceMetricsStrip logs={logs} levelCounts={levelCounts} />
        )}

        {/* Table Column Header */}
        <div className="h-7 px-4 bg-zinc-50/90 border-b border-zinc-200 flex items-center font-mono text-[10px] text-zinc-500 uppercase tracking-wider shrink-0 select-none">
          <div className="w-24 shrink-0">Timestamp</div>
          <div className="w-14 shrink-0">Level</div>
          <div className="w-36 shrink-0">Event</div>
          <div className="flex-1 min-w-0">Message</div>
          <div className="w-24 shrink-0 text-right pr-2">Trace / ID</div>
        </div>

        {/* Live Stream View */}
        <div
          ref={streamContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto bg-white font-mono text-xs divide-y divide-zinc-100"
        >
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-zinc-400 select-none">
              <div className="relative mb-4">
                <div className="w-12 h-12 rounded-full border border-zinc-200 flex items-center justify-center bg-zinc-50">
                  <Activity className="w-5 h-5 text-zinc-500 animate-pulse" />
                </div>
                <div className="absolute inset-0 rounded-full border border-emerald-500/20 animate-ping" />
              </div>
              <p className="text-sm font-medium text-zinc-700 mb-1">
                {connectionState === 'LIVE' ? 'Waiting for logs...' : 'Connecting to stream...'}
              </p>
              <p className="text-xs text-zinc-500 max-w-sm">
                Send logs to <code className="text-zinc-800 bg-zinc-100 px-1 py-0.5 rounded border border-zinc-200">/v1/logs</code> and they will stream live in real time.
              </p>
            </div>
          ) : (
            filteredLogs.map((log, index) => {
              const isSelected = selectedLog === log;
              return (
                <div
                  key={index}
                  onClick={() => setSelectedLog(log)}
                  className={cn(
                    "flex items-center px-4 py-1.5 cursor-pointer transition-colors group select-text leading-tight",
                    isSelected
                      ? "bg-zinc-100 text-zinc-950 font-medium"
                      : "hover:bg-zinc-50 text-zinc-800"
                  )}
                >
                  <span className="w-24 shrink-0 text-[11px] text-zinc-500 tabular-nums">
                    {format(new Date(log.timestamp), 'HH:mm:ss.SSS')}
                  </span>

                  <div className="w-14 shrink-0">
                    <LogLevelPill level={log.level} />
                  </div>

                  <span
                    className="w-36 shrink-0 text-zinc-600 font-medium truncate pr-2 group-hover:text-zinc-900"
                    title={log.event}
                  >
                    {log.event}
                  </span>

                  <span className="flex-1 min-w-0 truncate text-zinc-800 font-normal group-hover:text-zinc-950">
                    {log.message}
                  </span>

                  <span className="w-24 shrink-0 text-right pr-2 text-[10px] text-zinc-500 truncate group-hover:text-zinc-700">
                    {log.request_id || log.trace_id || '—'}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Stream Stats */}
        <div className="h-7 px-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between text-[11px] font-mono text-zinc-500 shrink-0">
          <div className="flex items-center gap-4">
            <span>Buffer: <strong className="text-zinc-700">{filteredLogs.length}</strong> events</span>
            {isPaused && (
              <span className="text-amber-700 flex items-center gap-1 font-medium">
                ● Stream paused (new logs held)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleAutoScroll}
              title={autoScroll ? "Auto-scroll is ON (click to turn OFF)" : "Auto-scroll is OFF (click to scroll to bottom & turn ON)"}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono border transition-all cursor-pointer select-none",
                autoScroll
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 font-semibold shadow-2xs"
                  : "bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-200 hover:text-zinc-900 font-normal"
              )}
            >
              <span className={cn(
                "w-1.5 h-1.5 rounded-full shrink-0",
                autoScroll ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
              )} />
              <ArrowDown className="w-3 h-3" />
              <span>Auto-scroll {autoScroll ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Slide-out Inspector Drawer */}
      {selectedLog && (
        <div className="w-2/5 max-w-xl bg-[#fdfcfb] flex flex-col overflow-hidden border-l border-zinc-200 animate-in slide-in-from-right-4 duration-150">
          <div className="h-13 px-5 flex items-center justify-between border-b border-zinc-200 bg-white">
            <div className="flex items-center gap-2">
              <LogLevelPill level={selectedLog.level} />
              <h3 className="font-mono text-xs font-semibold text-zinc-900 truncate">
                {selectedLog.event}
              </h3>
            </div>
            <button
              onClick={() => setSelectedLog(null)}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5 font-mono text-xs">
            {/* Primary message */}
            <div className="p-3.5 rounded-lg bg-white border border-zinc-200 shadow-2xs space-y-1.5">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500">
                Event Message
              </span>
              <p className="text-sm font-mono text-zinc-900 leading-relaxed break-words">
                {selectedLog.message}
              </p>
            </div>

            {/* Key-Value Properties */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500">
                Event Properties
              </span>
              <div className="grid grid-cols-2 gap-2">
                <InspectorProperty label="Timestamp" value={format(new Date(selectedLog.timestamp), 'yyyy-MM-dd HH:mm:ss.SSS')} />
                <InspectorProperty label="Level" value={selectedLog.level.toUpperCase()} />
                <InspectorProperty
                  label="Project"
                  value={
                    (selectedLog.project && !selectedLog.project.startsWith('proj_'))
                      ? selectedLog.project
                      : (projectName || selectedLog.project || projectId)
                  }
                />
                <InspectorProperty
                  label="Service"
                  value={
                    (selectedLog.service && !selectedLog.service.startsWith('serv_'))
                      ? selectedLog.service
                      : (serviceName || selectedLog.service || serviceId)
                  }
                />
                {(selectedLog.project_id || (selectedLog.project?.startsWith('proj_') ? selectedLog.project : projectId)) && (
                  <InspectorProperty
                    label="Project ID"
                    value={selectedLog.project_id || (selectedLog.project?.startsWith('proj_') ? selectedLog.project : projectId)}
                    copyable
                  />
                )}
                {(selectedLog.service_id || (selectedLog.service?.startsWith('serv_') ? selectedLog.service : serviceId)) && (
                  <InspectorProperty
                    label="Service ID"
                    value={selectedLog.service_id || (selectedLog.service?.startsWith('serv_') ? selectedLog.service : serviceId)}
                    copyable
                  />
                )}
                {selectedLog.request_id && (
                  <InspectorProperty label="Request ID" value={selectedLog.request_id} copyable />
                )}
                {selectedLog.trace_id && (
                  <InspectorProperty label="Trace ID" value={selectedLog.trace_id} copyable />
                )}
              </div>
            </div>

            {/* Metadata Payload */}
            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500">
                    Metadata Payload
                  </span>
                  <CopyButton text={JSON.stringify(selectedLog.metadata, null, 2)} label="Copy JSON" />
                </div>
                <pre className="p-3.5 rounded-lg bg-white border border-zinc-200 text-[11px] font-mono text-zinc-800 overflow-x-auto leading-relaxed shadow-2xs">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}

            {/* Complete Raw JSON */}
            <div className="space-y-2 pt-2 border-t border-zinc-200">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500">
                  Raw Record
                </span>
                <CopyButton text={JSON.stringify(selectedLog, null, 2)} label="Copy Full Event" />
              </div>
              <pre className="p-3.5 rounded-lg bg-white border border-zinc-200 text-[11px] font-mono text-zinc-700 overflow-x-auto leading-relaxed shadow-2xs">
                {JSON.stringify(selectedLog, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Delete Service Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteServiceModal}
        title="Delete Service"
        itemName={serviceName || serviceId}
        description="All indexed logs for this service will be permanently deleted."
        onConfirm={handleDeleteService}
        onClose={() => setShowDeleteServiceModal(false)}
      />

      {/* API Keys Modal */}
      <ApiKeysModal
        isOpen={showApiKeysModal}
        activeOrgId={activeOrgId || null}
        currentUserRole={isWrite ? 'write' : 'read'}
        initialServiceId={serviceId}
        onClose={() => setShowApiKeysModal(false)}
      />
    </div>
  );
}

function ConnectionStatusBadge({ state, isPaused }: { state: ConnectionState; isPaused: boolean }) {
  if (isPaused) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-50 text-amber-800 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        PAUSED
      </span>
    );
  }

  if (state === 'LIVE') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-600"></span>
        </span>
        LIVE
      </span>
    );
  }

  if (state === 'CONNECTING' || state === 'RECONNECTING') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-50 text-amber-800 border border-amber-200">
        <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-600" />
        {state}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-rose-50 text-rose-700 border border-rose-200">
      <WifiOff className="w-2.5 h-2.5" />
      DISCONNECTED
    </span>
  );
}

function LogLevelPill({ level }: { level: LogLevel }) {
  const styles = {
    info: "text-sky-700 bg-sky-50 border-sky-200",
    warn: "text-amber-800 bg-amber-50 border-amber-200",
    error: "text-rose-700 bg-rose-50 border-rose-200",
    debug: "text-zinc-600 bg-zinc-100 border-zinc-200"
  };

  return (
    <span className={cn(
      "inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider text-center border w-12",
      styles[level]
    )}>
      {level}
    </span>
  );
}

function InspectorProperty({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="p-2.5 rounded-lg bg-white border border-zinc-200 shadow-2xs flex flex-col justify-between">
      <span className="text-[10px] font-mono text-zinc-500 uppercase">{label}</span>
      <div className="flex items-center justify-between gap-1 mt-1">
        <span className="font-mono text-xs text-zinc-900 truncate" title={value}>
          {value}
        </span>
        {copyable && (
          <button
            onClick={handleCopy}
            className="text-zinc-400 hover:text-zinc-700 transition-colors p-0.5 shrink-0"
            title="Copy value"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
          </button>
        )}
      </div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-white hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900 border border-zinc-200 transition-colors text-[11px] font-mono shadow-2xs"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
      <span>{copied ? "Copied" : (label || "Copy")}</span>
    </button>
  );
}

function ServiceMetricsStrip({ logs, levelCounts }: { logs: LogEvent[]; levelCounts: Record<LogLevel, number> }) {
  const total = logs.length;
  if (total === 0) return null;

  const errorCount = levelCounts.error || 0;
  const warnCount = levelCounts.warn || 0;
  const infoCount = levelCounts.info || 0;
  const debugCount = levelCounts.debug || 0;

  const errorPct = ((errorCount / total) * 100).toFixed(1);
  const warnPct = ((warnCount / total) * 100).toFixed(1);
  const infoPct = ((infoCount / total) * 100).toFixed(1);
  const debugPct = ((debugCount / total) * 100).toFixed(1);

  // SVG Donut Calculations: circumference for r=15 is 2 * PI * 15 ≈ 94.25
  const c = 94.25;
  const errLen = (errorCount / total) * c;
  const warnLen = (warnCount / total) * c;
  const infoLen = (infoCount / total) * c;
  const debugLen = (debugCount / total) * c;

  let currentOffset = 0;
  const segments = [
    { name: 'error', len: errLen, color: '#f43f5e', offset: currentOffset },
    { name: 'warn', len: warnLen, color: '#f59e0b', offset: (currentOffset -= errLen) },
    { name: 'info', len: infoLen, color: '#0ea5e9', offset: (currentOffset -= warnLen) },
    { name: 'debug', len: debugLen, color: '#71717a', offset: (currentOffset -= infoLen) },
  ];

  // Activity Sparkline (16 bars across recent logs)
  const buckets = useMemo(() => {
    const count = 16;
    const res = Array.from({ length: count }, () => ({ total: 0, hasError: false }));
    const sample = logs.slice(0, 300);
    if (sample.length === 0) return res;

    const chunkSize = Math.max(1, Math.ceil(sample.length / count));
    for (let i = 0; i < sample.length; i++) {
      const bIdx = Math.min(Math.floor(i / chunkSize), count - 1);
      const targetIdx = count - 1 - bIdx;
      res[targetIdx].total += 1;
      if (sample[i].level === 'error') res[targetIdx].hasError = true;
    }
    return res;
  }, [logs]);

  const maxBucket = Math.max(...buckets.map(b => b.total), 1);

  // Top 2 Events
  const topEvents = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of logs) {
      const ev = l.event || 'general';
      counts[ev] = (counts[ev] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2);
  }, [logs]);

  return (
    <div className="border-b border-zinc-200 bg-[#fbfbfa] px-4 py-2 text-xs font-mono select-none">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 items-center">
        {/* Metric 1: Log Level Donut & Pie */}
        <div className="flex items-center gap-2.5 bg-white px-2.5 py-1.5 rounded-md border border-zinc-200/80 shadow-2xs">
          <div className="relative w-9 h-9 shrink-0 flex items-center justify-center">
            <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="transparent" stroke="#f4f4f5" strokeWidth="3" />
              {segments.map((seg, idx) => (
                <circle
                  key={idx}
                  cx="18"
                  cy="18"
                  r="15"
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth="3"
                  strokeDasharray={`${seg.len} ${c}`}
                  strokeDashoffset={seg.offset}
                />
              ))}
            </svg>
            <span className="absolute text-[9px] font-bold text-zinc-700">
              {total > 999 ? `${(total / 1000).toFixed(1)}k` : total}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider flex items-center justify-between font-semibold">
              <span>Level Split</span>
              <span className="text-zinc-600">{total} logs</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] truncate">
              <span className="text-sky-600 font-medium">info {infoPct}%</span>
              {warnCount > 0 && <span className="text-amber-600 font-medium">warn {warnPct}%</span>}
              {errorCount > 0 && <span className="text-rose-600 font-semibold">err {errorPct}%</span>}
            </div>
          </div>
        </div>

        {/* Metric 2: Activity Sparkline Bars */}
        <div className="bg-white px-2.5 py-1.5 rounded-md border border-zinc-200/80 shadow-2xs flex flex-col justify-between h-[48px]">
          <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
            <span>Throughput Graph</span>
            <span className="text-emerald-600 flex items-center gap-1 font-sans text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Live
            </span>
          </div>
          <div className="flex items-end gap-0.5 h-4 w-full">
            {buckets.map((b, idx) => {
              const heightPct = Math.max(20, Math.min(100, Math.round((b.total / maxBucket) * 100)));
              return (
                <div
                  key={idx}
                  title={`${b.total} logs${b.hasError ? ' (error)' : ''}`}
                  style={{ height: `${heightPct}%` }}
                  className={cn(
                    "flex-1 rounded-2xs transition-all",
                    b.hasError
                      ? "bg-rose-500"
                      : b.total > 0
                      ? "bg-zinc-300 hover:bg-zinc-400"
                      : "bg-zinc-100"
                  )}
                />
              );
            })}
          </div>
        </div>

        {/* Metric 3: Error Rate & Health KPI */}
        <div className="bg-white px-2.5 py-1.5 rounded-md border border-zinc-200/80 shadow-2xs flex items-center justify-between h-[48px]">
          <div>
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Error Rate</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className={cn(
                "text-sm font-bold",
                Number(errorPct) > 5 ? "text-rose-600" : Number(errorPct) > 0 ? "text-amber-600" : "text-emerald-600"
              )}>
                {errorPct}%
              </span>
              <span className="text-[10px] text-zinc-400">
                ({errorCount} failed)
              </span>
            </div>
          </div>
          <div className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center shrink-0 border",
            Number(errorPct) === 0
              ? "bg-emerald-50 border-emerald-200 text-emerald-600"
              : Number(errorPct) < 5
              ? "bg-amber-50 border-amber-200 text-amber-600"
              : "bg-rose-50 border-rose-200 text-rose-600"
          )}>
            <Activity className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Metric 4: Top Events Horizontal Bars */}
        <div className="bg-white px-2.5 py-1.5 rounded-md border border-zinc-200/80 shadow-2xs flex flex-col justify-between h-[48px]">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold flex justify-between">
            <span>Top Events</span>
            <span className="text-zinc-500">{topEvents.length} types</span>
          </div>
          <div className="space-y-1 mt-0.5">
            {topEvents.map(([ev, count]) => {
              const pct = Math.round((count / total) * 100);
              return (
                <div key={ev} className="flex items-center gap-1.5 text-[10px]">
                  <span className="truncate w-20 text-zinc-600 font-medium" title={ev}>{ev}</span>
                  <div className="flex-1 bg-zinc-100 rounded-full h-1 overflow-hidden">
                    <div className="bg-sky-500 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                  </div>
                  <span className="text-zinc-400 tabular-nums w-7 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

