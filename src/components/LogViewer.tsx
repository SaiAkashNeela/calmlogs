import React, { useEffect, useState, useRef, useCallback } from 'react';
import { LogEvent, LogLevel } from '../types';
import { format } from 'date-fns';
import { Wifi, WifiOff, Loader2, Search, X, Copy, Check } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ConnectionState = 'CONNECTING' | 'LIVE' | 'RECONNECTING' | 'DISCONNECTED';

interface LogViewerProps {
  projectId: string;
  serviceId: string;
}

export default function LogViewer({ projectId, serviceId }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('CONNECTING');
  const [selectedLog, setSelectedLog] = useState<LogEvent | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLevels, setActiveLevels] = useState<Set<LogLevel>>(new Set(['debug', 'info', 'warn', 'error']));
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const fetchHistorical = useCallback(async () => {
    try {
      const res = await fetch(`/api/historical?project_id=${projectId}&service_id=${serviceId}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(prev => {
          // Merge avoiding duplicates by basic check (simplistic)
          // Actually, just prepending historical before we get live
          // In a real app we'd deduplicate based on a unique log ID, but here we can just replace for now or merge
          return data;
        });
      }
    } catch (e) {
      console.error("Failed to fetch historical logs", e);
    }
  }, [projectId, serviceId]);

  const connectWs = useCallback(() => {
    setConnectionState(prev => prev === 'LIVE' ? 'LIVE' : 'CONNECTING');
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?project_id=${projectId}&service_id=${serviceId}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionState('LIVE');
    };

    ws.onmessage = (event) => {
      try {
        const log: LogEvent = JSON.parse(event.data);
        setLogs(prev => [log, ...prev].slice(0, 1000)); // keep last 1000 for perf
      } catch (e) { }
    };

    ws.onclose = () => {
      setConnectionState('DISCONNECTED');
      // Reconnect
      reconnectTimeoutRef.current = setTimeout(() => {
        setConnectionState('RECONNECTING');
        connectWs();
      }, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
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

  const filteredLogs = logs.filter(l => 
    activeLevels.has(l.level) &&
    (!searchQuery || 
    l.message.toLowerCase().includes(searchQuery.toLowerCase()) || 
    l.event.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Main List */}
      <div className={cn("flex flex-col flex-1 min-w-0 transition-all", selectedLog ? "w-2/3 border-r border-zinc-200/60" : "w-full")}>
        <div className="h-14 px-4 flex items-center justify-between border-b border-zinc-200/60 bg-white">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-sm">Logs</h2>
            <ConnectionIndicator state={connectionState} />
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-md">
              {(['debug', 'info', 'warn', 'error'] as LogLevel[]).map(level => (
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
                    "px-2.5 py-1 text-xs font-semibold rounded uppercase tracking-wider transition-colors",
                    activeLevels.has(level) 
                      ? "bg-white text-zinc-900 shadow-sm" 
                      : "text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50"
                  )}
                >
                  {level}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Filter logs..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 text-sm bg-zinc-50 border border-zinc-200 rounded-md outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-300 w-64 transition-all"
              />
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto bg-white p-2">
          {logs.length === 0 && connectionState === 'LIVE' ? (
             <div className="h-full flex flex-col items-center justify-center text-zinc-400">
               <p className="text-sm">Listening for logs...</p>
             </div>
          ) : (
            <div className="flex flex-col font-mono text-[13px] leading-relaxed">
              {filteredLogs.map((log, i) => (
                <div 
                  key={i} 
                  onClick={() => setSelectedLog(log)}
                  className={cn(
                    "flex gap-3 px-3 py-1.5 rounded cursor-pointer group border border-transparent",
                    selectedLog === log ? "bg-zinc-50 border-zinc-200" : "hover:bg-zinc-50"
                  )}
                >
                  <span className="text-zinc-400 whitespace-nowrap tabular-nums shrink-0">
                    {format(new Date(log.timestamp), 'HH:mm:ss.SSS')}
                  </span>
                  <LogLevelBadge level={log.level} />
                  <span className="text-zinc-600 font-medium shrink-0 w-32 truncate" title={log.event}>{log.event}</span>
                  <span className="text-zinc-800 truncate">{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Detail Panel */}
      {selectedLog && (
        <div className="w-1/3 bg-[#FDFCFB] flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-200">
          <div className="h-14 px-4 flex items-center justify-between border-b border-zinc-200/60 bg-white">
            <h3 className="font-semibold text-sm">Log Details</h3>
            <button onClick={() => setSelectedLog(null)} className="p-1 text-zinc-400 hover:text-zinc-900 rounded-md hover:bg-zinc-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <LogLevelBadge level={selectedLog.level} />
                <span className="text-sm font-medium text-zinc-900">{selectedLog.event}</span>
              </div>
              <p className="text-sm text-zinc-700 leading-relaxed">{selectedLog.message}</p>
            </div>
            
            <div className="space-y-3">
              <DetailRow label="Timestamp" value={format(new Date(selectedLog.timestamp), 'yyyy-MM-dd HH:mm:ss.SSS')} />
              <DetailRow label="Project" value={selectedLog.project} />
              <DetailRow label="Service" value={selectedLog.service} />
              {selectedLog.request_id && <DetailRow label="Request ID" value={selectedLog.request_id} copyable />}
              {selectedLog.trace_id && <DetailRow label="Trace ID" value={selectedLog.trace_id} copyable />}
            </div>
            
            {selectedLog.metadata && (
              <div>
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Metadata</h4>
                <div className="relative group">
                  <pre className="bg-zinc-900 text-zinc-50 p-3 rounded-md text-[12px] font-mono overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                  <CopyButton text={JSON.stringify(selectedLog.metadata, null, 2)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            )}
            
            <div className="pt-4 border-t border-zinc-200/60">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Raw JSON</h4>
                <div className="relative group">
                  <pre className="bg-white border border-zinc-200 p-3 rounded-md text-[12px] font-mono overflow-x-auto text-zinc-600">
                    {JSON.stringify(selectedLog, null, 2)}
                  </pre>
                  <CopyButton text={JSON.stringify(selectedLog, null, 2)} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-zinc-200 text-zinc-500 hover:bg-zinc-50" />
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ConnectionIndicator({ state }: { state: ConnectionState }) {
  if (state === 'LIVE') {
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-medium border border-emerald-100">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
        </span>
        LIVE
      </div>
    );
  }
  
  if (state === 'CONNECTING' || state === 'RECONNECTING') {
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[11px] font-medium border border-amber-100">
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
        {state}
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[11px] font-medium border border-rose-100">
      <WifiOff className="w-2.5 h-2.5" />
      DISCONNECTED
    </div>
  );
}

function LogLevelBadge({ level }: { level: LogLevel }) {
  const colors = {
    info: "text-blue-600 bg-blue-50 border-blue-100",
    warn: "text-amber-600 bg-amber-50 border-amber-100",
    error: "text-rose-600 bg-rose-50 border-rose-100",
    debug: "text-zinc-500 bg-zinc-100 border-zinc-200"
  };
  
  return (
    <span className={cn("px-1.5 py-[1px] rounded uppercase text-[10px] font-bold border tracking-wide w-12 text-center shrink-0", colors[level])}>
      {level}
    </span>
  );
}

function DetailRow({ label, value, copyable }: { label: string, value: string, copyable?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono text-zinc-900 bg-zinc-100/50 px-1.5 py-0.5 rounded border border-zinc-200/50">{value}</span>
        {copyable && <CopyButton text={value} />}
      </div>
    </div>
  );
}

function CopyButton({ text, className }: { text: string, className?: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <button 
      onClick={handleCopy}
      className={cn("p-1.5 rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors", className)}
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}
