const fs = require('fs');
let content = fs.readFileSync('src/components/LogViewer.tsx', 'utf8');

content = content.replace(
  "const [activeLevels, setActiveLevels] = useState<Set<LogLevel>>(new Set(['debug', 'info', 'warn', 'error']));\n  const [activeLevels, setActiveLevels] = useState<Set<LogLevel>>(new Set(['debug', 'info', 'warn', 'error']));",
  "const [activeLevels, setActiveLevels] = useState<Set<LogLevel>>(new Set(['debug', 'info', 'warn', 'error']));"
);

fs.writeFileSync('src/components/LogViewer.tsx', content);
