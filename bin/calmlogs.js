#!/usr/bin/env node
import readline from 'readline';
import { spawn } from 'child_process';
import http from 'http';
import https from 'https';

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

const project = getArg(['--project', '-p']);
const service = getArg(['--service', '-s']);
const key = getArg(['--key', '-k', '--api-key']);
const endpoint = getArg(['--endpoint', '-e'], process.env.CALMLOGS_ENDPOINT || 'http://localhost:3000');

if (!project || !service) {
  console.error('Usage: <command> | npx calmlogs --project <name> --service <name> [--key <api_key>] [--endpoint <url>]');
  console.error('   or: npx calmlogs run --project <name> --service <name> [--key <key>] -- <command>');
  process.exit(1);
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

  let event = 'app.log';
  let level = stream === 'stderr' ? 'error' : 'info';
  let message = trimmed;
  let metadata = undefined;

  // Try parsing JSON if structured
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.level) {
        level = typeof parsed.level === 'string' ? parsed.level.toLowerCase() : (parsed.level >= 50 ? 'error' : parsed.level >= 40 ? 'warn' : 'info');
      }
      if (parsed.message || parsed.msg) {
        message = String(parsed.message || parsed.msg);
      }
      if (parsed.event) {
        event = String(parsed.event);
      }
      metadata = parsed;
    } catch (e) {}
  }

  buffer.push({
    project,
    service,
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
