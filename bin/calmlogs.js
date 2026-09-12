#!/usr/bin/env node
import readline from 'readline';
import { spawn } from 'child_process';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);

function getArg(flags, defaultValue = '') {
  for (const flag of flags) {
    const idx = args.indexOf(flag);
    if (idx !== -1 && args[idx + 1]) {
      return args[idx + 1];
    }
    const prefix = `${flag}=`;
    const found = args.find(a => a.startsWith(prefix));
    if (found) {
      return found.slice(prefix.length);
    }
  }
  return defaultValue;
}

// Auto-detect service from package.json if present
let detectedService = '';
let detectedProject = '';

try {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (pkg && pkg.name) {
      detectedService = pkg.name.split('/').pop() || pkg.name;
    }
  }
} catch (_) {}

try {
  const cwdName = path.basename(process.cwd());
  if (cwdName) {
    detectedProject = cwdName;
  }
} catch (_) {}

const project = getArg(
  ['--project', '-p'],
  process.env.CALMLOGS_PROJECT || process.env.PROJECT_NAME || detectedProject || 'default'
);
const service = getArg(
  ['--service', '-s'],
  process.env.CALMLOGS_SERVICE || process.env.SERVICE_NAME || process.env.APP_NAME || detectedService || 'app'
);
const key = getArg(
  ['--key', '-k', '--api-key'],
  process.env.CALMLOGS_KEY || process.env.CALMLOGS_API_KEY || ''
);
const endpoint = getArg(
  ['--endpoint', '-e'],
  process.env.CALMLOGS_ENDPOINT || 'https://calmlogs.mrsan.workers.dev'
);

const networkFilter = getArg(['--network', '-n']);

// Inform user when project or service were auto-resolved
const explicitProject = getArg(['--project', '-p']);
const explicitService = getArg(['--service', '-s']);
if (!explicitProject || !explicitService) {
  process.stderr.write(`[calmlogs] Ingesting logs -> project: "${project}", service: "${service}"\n`);
}

// Parse Docker Compose prefix e.g. "web-1 | ...", "api_1 | ...", "postgres | ..."
function parseComposeLine(line) {
  const pipeIdx = line.indexOf('|');
  if (pipeIdx === -1) return null;
  const prefix = line.slice(0, pipeIdx).trim();
  // Compose prefixes contain no whitespace and are reasonably short container/service tags
  if (!prefix || /\s/.test(prefix) || prefix.length > 60) return null;
  
  // Strip container index suffix like -1, _1, -2, _2
  const cleanService = prefix.replace(/[-_]\d+$/, '');
  const content = line.slice(pipeIdx + 1).trim();
  return { service: cleanService, message: content };
}

const buffer = [];
let flushTimeout = null;

function flushLogs() {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, buffer.length);
  const payload = JSON.stringify(batch);

  try {
    const targetUrl = new URL('/v1/logs', endpoint);
    const client = targetUrl.protocol === 'https:' ? https : http;
    
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    };
    if (key) {
      headers['Authorization'] = `Bearer ${key}`;
    }

    const req = client.request(targetUrl, {
      method: 'POST',
      headers
    }, (res) => {
      res.resume(); // discard response body
    });

    req.on('error', () => {}); // never crash the caller
    req.write(payload);
    req.end();
  } catch (e) {}
}

function queueLog(line, stream = 'stdout') {
  const trimmed = line.trim();
  if (!trimmed) return;

  let currentService = service;
  let logContent = trimmed;

  // Auto-detect Docker Compose lines: dynamically map to service & clean message
  const composeParsed = parseComposeLine(trimmed);
  if (composeParsed) {
    currentService = composeParsed.service;
    logContent = composeParsed.message;
  }

  let event = 'app.log';
  let level = stream === 'stderr' ? 'error' : 'info';
  let message = logContent;
  let metadata = networkFilter ? { network: networkFilter } : undefined;

  // Try parsing JSON if structured
  if (logContent.startsWith('{') && logContent.endsWith('}')) {
    try {
      const parsed = JSON.parse(logContent);
      if (parsed.level) {
        level = typeof parsed.level === 'string' ? parsed.level.toLowerCase() : (parsed.level >= 50 ? 'error' : parsed.level >= 40 ? 'warn' : 'info');
      }
      if (parsed.message || parsed.msg) {
        message = String(parsed.message || parsed.msg);
      }
      if (parsed.event) {
        event = String(parsed.event);
      }
      metadata = metadata ? { ...metadata, ...parsed } : parsed;
    } catch (e) {}
  }

  buffer.push({
    project,
    service: currentService,
    level,
    event,
    message,
    metadata,
    timestamp: new Date().toISOString()
  });

  if (buffer.length >= 50) {
    if (flushTimeout) clearTimeout(flushTimeout);
    flushLogs();
  } else if (!flushTimeout) {
    flushTimeout = setTimeout(() => {
      flushTimeout = null;
      flushLogs();
    }, 250);
  }
}

// Check for "run" sub-command
const runIdx = args.indexOf('run');
const separatorIdx = args.indexOf('--');

if (runIdx !== -1 && separatorIdx !== -1 && separatorIdx < args.length - 1) {
  const fullCommand = args.slice(separatorIdx + 1).join(' ');
  const child = spawn(fullCommand, {
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true
  });

  const rlOut = readline.createInterface({ input: child.stdout });
  rlOut.on('line', (line) => {
    process.stdout.write(line + '\n');
    queueLog(line, 'stdout');
  });

  const rlErr = readline.createInterface({ input: child.stderr });
  rlErr.on('line', (line) => {
    process.stderr.write(line + '\n');
    queueLog(line, 'stderr');
  });

  child.on('close', (code) => {
    flushLogs();
    process.exit(code ?? 0);
  });

  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
} else {
  // Pipe mode: reading from stdin
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on('line', (line) => {
    queueLog(line, 'stdout');
  });

  rl.on('close', () => {
    flushLogs();
    setTimeout(() => process.exit(0), 100);
  });
}

process.on('beforeExit', flushLogs);
