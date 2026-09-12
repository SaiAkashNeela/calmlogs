import { DurableObject } from "cloudflare:workers";
import { createAuth } from "./auth";

export interface Env {
  DB: D1Database;
  LOG_BUCKET: R2Bucket;
  REALTIME: DurableObjectNamespace;
  ASSETS?: Fetcher;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEvent {
  project: string;
  service: string;
  level: LogLevel;
  event: string;
  message: string;
  timestamp: string;
  request_id?: string;
  trace_id?: string;
  metadata?: any;
}

async function sha256Hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export class RealtimeLogStream extends DurableObject {
  private buffer: LogEvent[] = [];
  private currentSegmentSize: number = 0;
  private readonly MAX_BUFFER_SIZE = 1000;
  private readonly MAX_BYTE_SIZE = 5 * 1024 * 1024; // 5MB
  private flushTimeout: any = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/ws') {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected Upgrade: websocket", { status: 426 });
      }
      const { 0: client, 1: server } = new WebSocketPair();
      this.ctx.acceptWebSocket(server);
      
      // Replay recent in-memory logs to newly connected client
      for (const log of this.buffer.slice(-50)) {
        try {
          server.send(JSON.stringify(log));
        } catch (e) {}
      }
      return new Response(null, { status: 101, webSocket: client });
    }
    
    if (url.pathname === '/ingest' && request.method === 'POST') {
      try {
        const payload: any = await request.json();
        if (Array.isArray(payload)) {
          for (const item of payload) {
            await this.handleIncomingLog(item);
          }
        } else {
          await this.handleIncomingLog(payload);
        }
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 400 });
      }
    }

    return new Response("Not found", { status: 404 });
  }

  async handleIncomingLog(log: LogEvent) {
    const msg = JSON.stringify(log);
    const size = new TextEncoder().encode(msg).byteLength;
    
    this.ctx.getWebSockets().forEach((ws) => {
      try {
        ws.send(msg);
      } catch (e) {}
    });

    this.buffer.push(log);
    this.currentSegmentSize += size;

    if (this.buffer.length >= this.MAX_BUFFER_SIZE || this.currentSegmentSize >= this.MAX_BYTE_SIZE) {
      await this.flushBuffer();
    } else {
      const currentAlarm = await this.ctx.storage.getAlarm();
      if (currentAlarm === null) {
        await this.ctx.storage.setAlarm(Date.now() + 10000); 
      }
    }
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    try {
      const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
      const data = JSON.parse(text);
      if (Array.isArray(data)) {
        for (const item of data) {
          await this.handleIncomingLog(item);
        }
      } else if (data && typeof data === 'object') {
        await this.handleIncomingLog(data);
      }
    } catch (e) {}
  }

  async alarm() {
    await this.flushBuffer();
  }

  async flushBuffer() {
    if (this.buffer.length === 0) return;
    
    const logs = [...this.buffer];
    this.buffer = [];
    this.currentSegmentSize = 0;
    
    const projectId = (logs[0] as any).project_id || logs[0].project;
    const serviceId = (logs[0] as any).service_id || logs[0].service;
    
    const date = new Date();
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const ts = date.getTime();
    
    const key = `logs/${projectId}/${serviceId}/${year}/${month}/${day}/segment-${ts}.jsonl`;
    const jsonl = logs.map(l => JSON.stringify(l)).join('\n');
    
    try {
      await this.env.LOG_BUCKET.put(key, jsonl);
      
      await this.env.DB.prepare(
        `INSERT INTO log_indexes (id, project_id, service_id, segment_path, start_time, end_time, record_count, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        `seg_${ts}`, 
        projectId, 
        serviceId, 
        key, 
        logs[0].timestamp, 
        logs[logs.length-1].timestamp, 
        logs.length,
        date.toISOString()
      ).run();
    } catch (e) {
      console.error("Flush error", e);
    }
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Better Auth Handler
    if (url.pathname.startsWith("/api/auth/")) {
      const auth = createAuth(env);
      return auth.handler(request);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
          "Access-Control-Max-Age": "86400",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY"
        }
      });
    }

    const addCors = (res: Response) => {
      const headers = new Headers(res.headers);
      headers.set("Access-Control-Allow-Origin", "*");
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("X-Frame-Options", "DENY");
      headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    };

    // Get auth session for protected routes
    const auth = createAuth(env);
    const session = await auth.api.getSession({ headers: request.headers });

    // Protect API routes
    const isProtectedApi = url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auth');
    if (isProtectedApi && !session?.session) {
      return addCors(new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }));
    }

    if (url.pathname === '/api/user/delete' && request.method === 'POST') {
      const userId = (session as any)?.user?.id || session?.session?.userId;
      if (!userId) return addCors(new Response("Unauthorized", { status: 401 }));

      await env.DB.prepare(`DELETE FROM session WHERE userId = ?`).bind(userId).run();
      await env.DB.prepare(`DELETE FROM account WHERE userId = ?`).bind(userId).run();
      await env.DB.prepare(`DELETE FROM member WHERE userId = ?`).bind(userId).run();
      await env.DB.prepare(`DELETE FROM user WHERE id = ?`).bind(userId).run();

      return addCors(new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } }));
    }

    if (url.pathname.startsWith('/api/projects')) {
      if (request.method === 'GET') {
        const activeOrgId = session?.session?.activeOrganizationId;
        if (!activeOrgId) return addCors(new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } }));

        const { results } = await env.DB.prepare(`SELECT * FROM projects WHERE organization_id = ? ORDER BY name ASC`).bind(activeOrgId).all();
        return addCors(new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } }));
      }
      if (request.method === 'POST') {
        const activeOrgId = session?.session?.activeOrganizationId;
        if (!activeOrgId) return addCors(new Response("Requires active organization", { status: 400 }));

        const userId = session?.user?.id;
        const memberRow = await env.DB.prepare(
          `SELECT role FROM member WHERE organizationId = ? AND userId = ?`
        ).bind(activeOrgId, userId).first<{ role: string }>();
        if (memberRow?.role === 'read') {
          return addCors(new Response(JSON.stringify({ error: "Read-only access: you cannot create resources" }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          }));
        }

        const body: any = await request.json();
        const id = `proj_${Date.now()}`;
        const now = new Date().toISOString();
        await env.DB.prepare(`INSERT INTO projects (id, organization_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
          .bind(id, activeOrgId, body.name, body.description || '', now, now).run();

        let apiKey: string | null = null;
        let defaultService: any = null;

        if (body.isCompose) {
          const servId = `serv_${Date.now()}`;
          const servName = 'compose';
          apiKey = `cl_live_${crypto.randomUUID().replace(/-/g, '')}`;
          const keyHash = await sha256Hex(apiKey);

          await env.DB.prepare(
            `INSERT INTO services (id, project_id, name, type, created_at, updated_at, last_seen_at, ingestion_key_hash) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(servId, id, servName, 'compose', now, now, now, keyHash).run();

          defaultService = { id: servId, name: servName, project_id: id };
        }

        return addCors(new Response(JSON.stringify({ 
          id, 
          name: body.name,
          description: body.description || '',
          isCompose: !!body.isCompose,
          composeNetwork: body.composeNetwork || '',
          apiKey,
          defaultService
        }), { headers: { 'Content-Type': 'application/json' } }));
      }
      if (request.method === 'DELETE') {
        const activeOrgId = session?.session?.activeOrganizationId;
        if (!activeOrgId) return addCors(new Response("Requires active organization", { status: 400 }));

        const userId = session?.user?.id;
        const memberRow = await env.DB.prepare(
          `SELECT role FROM member WHERE organizationId = ? AND userId = ?`
        ).bind(activeOrgId, userId).first<{ role: string }>();
        if (memberRow?.role === 'read') {
          return addCors(new Response(JSON.stringify({ error: "Read-only access" }), { status: 403 }));
        }

        const projectId = url.searchParams.get('id');
        if (!projectId) return addCors(new Response("Missing project id", { status: 400 }));

        const pCheck = await env.DB.prepare(`SELECT id FROM projects WHERE id = ? AND organization_id = ?`).bind(projectId, activeOrgId).first();
        if (!pCheck) return addCors(new Response("Project not found", { status: 404 }));

        await env.DB.prepare(`DELETE FROM services WHERE project_id = ?`).bind(projectId).run();
        await env.DB.prepare(`DELETE FROM log_indexes WHERE project_id = ?`).bind(projectId).run();
        await env.DB.prepare(`DELETE FROM projects WHERE id = ?`).bind(projectId).run();

        return addCors(new Response(JSON.stringify({ success: true, id: projectId }), { headers: { 'Content-Type': 'application/json' } }));
      }
    }

    if (url.pathname.startsWith('/api/services')) {
      if (request.method === 'GET') {
        const projectId = url.searchParams.get('project_id');
        const activeOrgId = session?.session?.activeOrganizationId;
        if (!activeOrgId) return addCors(new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } }));

        let query = `SELECT s.* FROM services s JOIN projects p ON s.project_id = p.id WHERE p.organization_id = ?`;
        let bind: any[] = [activeOrgId];
        if (projectId) {
          query += ` AND p.id = ?`;
          bind.push(projectId);
        }
        query += ` ORDER BY s.name ASC`;
        const { results } = await env.DB.prepare(query).bind(...bind).all();
        return addCors(new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } }));
      }
      if (request.method === 'POST') {
        const activeOrgId = session?.session?.activeOrganizationId;
        if (!activeOrgId) return addCors(new Response("Requires active organization", { status: 400 }));

        const userId = session?.user?.id;
        const memberRow = await env.DB.prepare(
          `SELECT role FROM member WHERE organizationId = ? AND userId = ?`
        ).bind(activeOrgId, userId).first<{ role: string }>();
        if (memberRow?.role === 'read') {
          return addCors(new Response(JSON.stringify({ error: "Read-only access: you cannot create resources" }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          }));
        }

        const body: any = await request.json();
        const { projectId, name, type } = body;
        if (!projectId || !name) return addCors(new Response("Missing projectId or name", { status: 400 }));

        const pCheck = await env.DB.prepare(`SELECT id FROM projects WHERE id = ? AND organization_id = ?`).bind(projectId, activeOrgId).first();
        if (!pCheck) return addCors(new Response("Project not found or unauthorized", { status: 404 }));

        const servId = `serv_${Date.now()}`;
        const now = new Date().toISOString();
        const rawApiKey = `cl_live_${crypto.randomUUID().replace(/-/g, '')}`;
        const keyHash = await sha256Hex(rawApiKey);

        await env.DB.prepare(
          `INSERT INTO services (id, project_id, name, type, created_at, updated_at, last_seen_at, ingestion_key_hash) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(servId, projectId, name, type || 'api', now, now, now, keyHash).run();

        return addCors(new Response(JSON.stringify({ 
          id: servId, 
          project_id: projectId, 
          name,
          apiKey: rawApiKey
        }), { headers: { 'Content-Type': 'application/json' } }));
      }
      if (request.method === 'DELETE') {
        const activeOrgId = session?.session?.activeOrganizationId;
        if (!activeOrgId) return addCors(new Response("Requires active organization", { status: 400 }));

        const userId = session?.user?.id;
        const memberRow = await env.DB.prepare(
          `SELECT role FROM member WHERE organizationId = ? AND userId = ?`
        ).bind(activeOrgId, userId).first<{ role: string }>();
        if (memberRow?.role === 'read') {
          return addCors(new Response(JSON.stringify({ error: "Read-only access" }), { status: 403 }));
        }

        const serviceId = url.searchParams.get('id');
        if (!serviceId) return addCors(new Response("Missing service id", { status: 400 }));

        const sCheck = await env.DB.prepare(`
          SELECT s.id FROM services s JOIN projects p ON s.project_id = p.id 
          WHERE s.id = ? AND p.organization_id = ?
        `).bind(serviceId, activeOrgId).first();
        if (!sCheck) return addCors(new Response("Service not found", { status: 404 }));

        await env.DB.prepare(`DELETE FROM log_indexes WHERE service_id = ?`).bind(serviceId).run();
        await env.DB.prepare(`DELETE FROM services WHERE id = ?`).bind(serviceId).run();

        return addCors(new Response(JSON.stringify({ success: true, id: serviceId }), { headers: { 'Content-Type': 'application/json' } }));
      }
    }

    if (url.pathname.startsWith('/api/keys')) {
      const activeOrgId = session?.session?.activeOrganizationId;
      if (!activeOrgId) return addCors(new Response("Requires active organization", { status: 400 }));

      const userId = session?.user?.id;
      const memberRow = await env.DB.prepare(
        `SELECT role FROM member WHERE organizationId = ? AND userId = ?`
      ).bind(activeOrgId, userId).first<{ role: string }>();

      if (request.method === 'GET') {
        const { results } = await env.DB.prepare(`
          SELECT 
            s.id as service_id, 
            s.name as service_name, 
            s.type as service_type, 
            s.project_id, 
            p.name as project_name, 
            s.created_at, 
            s.last_seen_at,
            CASE WHEN s.ingestion_key_hash IS NOT NULL AND s.ingestion_key_hash != '' THEN 1 ELSE 0 END as has_key
          FROM services s
          JOIN projects p ON s.project_id = p.id
          WHERE p.organization_id = ?
          ORDER BY s.created_at DESC
        `).bind(activeOrgId).all();

        return addCors(new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } }));
      }

      if (memberRow?.role === 'read') {
        return addCors(new Response(JSON.stringify({ error: "Read-only access: cannot modify keys" }), { status: 403 }));
      }

      if (request.method === 'DELETE') {
        const serviceId = url.searchParams.get('service_id') || url.searchParams.get('id');
        if (!serviceId) return addCors(new Response("Missing service_id", { status: 400 }));

        const sCheck = await env.DB.prepare(`
          SELECT s.id FROM services s JOIN projects p ON s.project_id = p.id 
          WHERE s.id = ? AND p.organization_id = ?
        `).bind(serviceId, activeOrgId).first();
        if (!sCheck) return addCors(new Response("Service not found or unauthorized", { status: 404 }));

        const now = new Date().toISOString();
        await env.DB.prepare(`UPDATE services SET ingestion_key_hash = NULL, updated_at = ? WHERE id = ?`)
          .bind(now, serviceId).run();

        return addCors(new Response(JSON.stringify({ success: true, service_id: serviceId, has_key: 0 }), {
          headers: { 'Content-Type': 'application/json' }
        }));
      }

      if (request.method === 'POST') {
        const body: any = await request.json().catch(() => ({}));
        const serviceId = body.service_id || body.serviceId || url.searchParams.get('service_id') || url.searchParams.get('id');
        if (!serviceId) return addCors(new Response("Missing service_id", { status: 400 }));

        const sCheck = await env.DB.prepare(`
          SELECT s.id, s.name, p.name as project_name FROM services s JOIN projects p ON s.project_id = p.id 
          WHERE s.id = ? AND p.organization_id = ?
        `).bind(serviceId, activeOrgId).first<{ id: string; name: string; project_name: string }>();
        if (!sCheck) return addCors(new Response("Service not found or unauthorized", { status: 404 }));

        const rawApiKey = `cl_live_${crypto.randomUUID().replace(/-/g, '')}`;
        const keyHash = await sha256Hex(rawApiKey);
        const now = new Date().toISOString();

        await env.DB.prepare(`UPDATE services SET ingestion_key_hash = ?, updated_at = ? WHERE id = ?`)
          .bind(keyHash, now, serviceId).run();

        return addCors(new Response(JSON.stringify({ 
          success: true, 
          service_id: serviceId, 
          service_name: sCheck.name,
          project_name: sCheck.project_name,
          apiKey: rawApiKey,
          has_key: 1 
        }), { headers: { 'Content-Type': 'application/json' } }));
      }
    }
    
    if (url.pathname.startsWith('/api/historical')) {
       const projectId = url.searchParams.get('project_id');
       const serviceId = url.searchParams.get('service_id');
       
       if (!projectId || !serviceId) {
         return addCors(new Response(JSON.stringify({error: "Missing params"}), {status: 400}));
       }
       
       const activeOrgId = session?.session?.activeOrganizationId;
       if (!activeOrgId) return addCors(new Response("Unauthorized", { status: 401 }));

       // Verify project belongs to org
       const pCheck = await env.DB.prepare(`SELECT id FROM projects WHERE id = ? AND organization_id = ?`).bind(projectId, activeOrgId).first();
       if (!pCheck) return addCors(new Response("Not found or unauthorized", { status: 404 }));

       const { results } = await env.DB.prepare(`
         SELECT segment_path FROM log_indexes 
         WHERE project_id = ? AND service_id = ?
         ORDER BY created_at DESC LIMIT 5
       `).bind(projectId, serviceId).all();
       
       const logs = [];
       for (const row of results) {
         const obj = await env.LOG_BUCKET.get(row.segment_path as string);
         if (obj) {
           const text = await obj.text();
           const lines = text.split('\n').filter(Boolean);
           for (const line of lines) {
             try { logs.push(JSON.parse(line)); } catch(e) {}
           }
         }
       }
       
       logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
       return addCors(new Response(JSON.stringify(logs), { headers: { 'Content-Type': 'application/json' } }));
    }

    // Ingestion API (Service to platform - supports single LogEvent or batch LogEvent[])
    if (url.pathname === '/v1/logs' && request.method === 'POST') {
      try {
        // Defensive Payload Size Check (Max 5MB)
        const contentLength = parseInt(request.headers.get("Content-Length") || "0", 10);
        if (contentLength > 5 * 1024 * 1024) {
          return addCors(new Response(JSON.stringify({ error: "Payload Too Large: maximum body size is 5MB" }), { status: 413 }));
        }

        const rawBody: any = await request.json();
        const logsArray: any[] = Array.isArray(rawBody) ? rawBody : [rawBody];
        
        if (logsArray.length === 0) {
          return addCors(new Response(JSON.stringify({ error: "Empty logs payload" }), { status: 400 }));
        }

        // Defensive Batch Limit (Max 1,000 logs per batch)
        if (logsArray.length > 1000) {
          return addCors(new Response(JSON.stringify({ error: "Batch limit exceeded: maximum 1,000 logs per request" }), { status: 400 }));
        }

        const now = new Date().toISOString();

        // Extract auth token if provided
        const authHeader = request.headers.get("Authorization") || request.headers.get("X-API-Key") || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();

        // Check if token matches a registered service API key
        let keyInfo: { serviceId: string; serviceName: string; projectId: string; projectName: string } | null = null;
        if (token) {
          const tokenHash = await sha256Hex(token);
          const matched = await env.DB.prepare(
            `SELECT s.id as service_id, s.name as service_name, s.project_id, p.name as project_name 
             FROM services s 
             JOIN projects p ON s.project_id = p.id 
             WHERE s.ingestion_key_hash = ? LIMIT 1`
          ).bind(tokenHash).first<{ service_id: string; service_name: string; project_id: string; project_name: string }>();
          if (matched) {
            keyInfo = {
              serviceId: matched.service_id,
              serviceName: matched.service_name,
              projectId: matched.project_id,
              projectName: matched.project_name
            };
          } else {
            return addCors(new Response(JSON.stringify({ error: "Invalid or revoked API key" }), { status: 401 }));
          }
        }

        // Group by project and service with strict input sanitization
        const groups = new Map<string, { rawProj: string; rawServ: string; items: any[] }>();
        for (const item of logsArray) {
          let rawProj = typeof item.project === 'string' ? item.project.trim() : '';
          let rawServ = typeof item.service === 'string' ? item.service.trim() : '';
          
          // Auto-resolve missing project or service from API Key
          if (!rawProj && keyInfo) rawProj = keyInfo.projectName;
          if (!rawServ && keyInfo) rawServ = keyInfo.serviceName;

          // Safe fallback defaults so logs are never dropped
          if (!rawProj) rawProj = 'default';
          if (!rawServ) rawServ = 'app';

          // Sanitize identifiers against delimiter injection or directory traversal
          rawProj = rawProj.replace(/[^a-zA-Z0-9_\-\.]/g, '_').slice(0, 64);
          rawServ = rawServ.replace(/[^a-zA-Z0-9_\-\.]/g, '_').slice(0, 64);
          
          const groupKey = `${rawProj}:::${rawServ}`;
          if (!groups.has(groupKey)) {
            groups.set(groupKey, { rawProj, rawServ, items: [] });
          }
          groups.get(groupKey)!.items.push(item);
        }

        if (groups.size === 0) {
          return addCors(new Response(JSON.stringify({ error: "No valid log events found" }), { status: 400 }));
        }

        let totalIngested = 0;
        let lastProjId = '';
        let lastServId = '';

        for (const [, group] of groups) {
          const { rawProj, rawServ, items } = group;

          // 1. Resolve project
          let project = await env.DB.prepare(
            `SELECT id, organization_id, name FROM projects WHERE id = ? OR LOWER(name) = LOWER(?) LIMIT 1`
          ).bind(rawProj, rawProj).first<{ id: string; organization_id: string; name: string }>();

          let projId = project?.id;
          let orgId = project?.organization_id;

          if (!project) {
            orgId = session?.session?.activeOrganizationId || 'org_default';
            projId = rawProj.toLowerCase().startsWith('proj_') ? rawProj : `proj_${Date.now()}`;
            
            await env.DB.prepare(`INSERT INTO organization (id, name, createdAt) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING`)
              .bind(orgId, 'Default Workspace', now).run();

            await env.DB.prepare(`INSERT INTO projects (id, organization_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`)
              .bind(projId, orgId, rawProj, 'Auto-registered project', now, now).run();
            project = { id: projId, organization_id: orgId, name: rawProj };
          }

          // 2. Resolve service
          let service = await env.DB.prepare(
            `SELECT id, name, ingestion_key_hash FROM services WHERE project_id = ? AND (id = ? OR LOWER(name) = LOWER(?)) LIMIT 1`
          ).bind(projId, rawServ, rawServ).first<{ id: string; name: string; ingestion_key_hash?: string | null }>();

          let servId = service?.id;

          if (!service) {
            servId = rawServ.toLowerCase().startsWith('serv_') ? rawServ : `serv_${Date.now()}`;
            // Inherit project key hash if authenticated with a key for this project
            const inheritKeyHash = (keyInfo && keyInfo.projectId === projId && token) ? await sha256Hex(token) : null;
            await env.DB.prepare(
              `INSERT INTO services (id, project_id, name, type, created_at, updated_at, last_seen_at, ingestion_key_hash) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?) 
               ON CONFLICT(id) DO UPDATE SET last_seen_at = excluded.last_seen_at`
            ).bind(servId, projId, rawServ, 'api', now, now, now, inheritKeyHash).run();
            service = { id: servId, name: rawServ, ingestion_key_hash: inheritKeyHash };
          } else {
            // Validate API key if configured
            if (service.ingestion_key_hash) {
              const tokenHash = token ? await sha256Hex(token) : "";
              const matchesService = token && tokenHash === service.ingestion_key_hash;
              const matchesProject = keyInfo && keyInfo.projectId === projId;
              if (!matchesService && !matchesProject) {
                return addCors(new Response(JSON.stringify({ 
                  error: `Unauthorized: Invalid or missing API key for service '${service.name}'` 
                }), {
                  status: 401,
                  headers: { 'Content-Type': 'application/json' }
                }));
              }
            }

            await env.DB.prepare(`UPDATE services SET last_seen_at = ?, updated_at = ? WHERE id = ?`)
              .bind(now, now, servId).run();
          }

          const projectName = project?.name || rawProj;
          const serviceName = service?.name || rawServ;

          const enrichedLogs: LogEvent[] = items.map(item => ({
            ...item,
            project: projectName,
            service: serviceName,
            project_id: projId!,
            service_id: servId!,
            message: typeof item.message === 'string' ? item.message.slice(0, 65536) : String(item.message || ''),
            timestamp: item.timestamp || now
          }));

          const doId = env.REALTIME.idFromName(`${projId}:${servId}`);
          const stub = env.REALTIME.get(doId);
          
          const doReq = new Request(new URL('/ingest', request.url), {
            method: 'POST',
            body: JSON.stringify(enrichedLogs),
            headers: { 'Content-Type': 'application/json' }
          });
          
          await stub.fetch(doReq);
          totalIngested += enrichedLogs.length;
          lastProjId = projId!;
          lastServId = servId!;
        }

        return addCors(new Response(JSON.stringify({ success: true, count: totalIngested, project_id: lastProjId, service_id: lastServId }), {
          headers: { 'Content-Type': 'application/json' }
        }));
      } catch (e: any) {
        return addCors(new Response(JSON.stringify({ error: e.message }), { status: 500 }));
      }
    }
    
    // WebSockets connection from UI
    if (url.pathname === '/ws') {
      const rawProj = url.searchParams.get('project_id');
      const rawServ = url.searchParams.get('service_id');
      
      if (!rawProj || !rawServ) {
        return new Response("Missing project or service", { status: 400 });
      }

      // Resolve canonical project ID
      const project = await env.DB.prepare(
        `SELECT id FROM projects WHERE id = ? OR LOWER(name) = LOWER(?) LIMIT 1`
      ).bind(rawProj, rawProj).first<{ id: string }>();
      const projId = project?.id || rawProj;

      // Resolve canonical service ID
      const service = await env.DB.prepare(
        `SELECT id FROM services WHERE project_id = ? AND (id = ? OR LOWER(name) = LOWER(?)) LIMIT 1`
      ).bind(projId, rawServ, rawServ).first<{ id: string }>();
      const servId = service?.id || rawServ;
      
      const doId = env.REALTIME.idFromName(`${projId}:${servId}`);
      const stub = env.REALTIME.get(doId);
      
      return stub.fetch(new Request(url.toString(), {
        headers: request.headers
      }));
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return addCors(new Response("Not found", { status: 404 }));
  }
};
