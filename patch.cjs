const fs = require('fs');
let content = fs.readFileSync('src/components/LogViewer.tsx', 'utf8');

content = content.replace(
  "const [searchQuery, setSearchQuery] = useState('');",
  "const [searchQuery, setSearchQuery] = useState('');\n  const [activeLevels, setActiveLevels] = useState<Set<LogLevel>>(new Set(['debug', 'info', 'warn', 'error']));"
);

content = content.replace(
  "const filteredLogs = logs.filter(l => \n    !searchQuery || \n    l.message.toLowerCase().includes(searchQuery.toLowerCase()) || \n    l.event.toLowerCase().includes(searchQuery.toLowerCase())\n  );",
  "const filteredLogs = logs.filter(l => \n    activeLevels.has(l.level) &&\n    (!searchQuery || \n    l.message.toLowerCase().includes(searchQuery.toLowerCase()) || \n    l.event.toLowerCase().includes(searchQuery.toLowerCase()))\n  );"
);

const oldHeader = `<div className="h-14 px-4 flex items-center justify-between border-b border-zinc-200/60 bg-white">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-sm">Logs</h2>
            <ConnectionIndicator state={connectionState} />
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
        </div>`;

const newHeader = `<div className="h-14 px-4 flex items-center justify-between border-b border-zinc-200/60 bg-white">
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
        </div>`;

content = content.replace(oldHeader, newHeader);

fs.writeFileSync('src/components/LogViewer.tsx', content);
console.log('patched');
