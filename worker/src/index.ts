import { DurableObject } from "cloudflare:workers";
import { createAuth } from "./auth";

export interface Env {
  DB: D1Database;
  LOG_BUCKET: R2Bucket;
  REALTIME: DurableObjectNamespace;
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
        const payload: LogEvent = await request.json();
        await this.handleIncomingLog(payload);
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

  async alarm() {
    await this.flushBuffer();
  }

  async flushBuffer() {
    if (this.buffer.length === 0) return;
    
    const logs = [...this.buffer];
    this.buffer = [];
    this.currentSegmentSize = 0;
    
    const project = logs[0].project;
    const service = logs[0].service;
    
    const date = new Date();
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const ts = date.getTime();
    
    const key = `logs/${project}/${service}/${year}/${month}/${day}/segment-${ts}.jsonl`;
    const jsonl = logs.map(l => JSON.stringify(l)).join('\n');
    
    try {
      await this.env.LOG_BUCKET.put(key, jsonl);
      
      await this.env.DB.prepare(
        `INSERT INTO log_indexes (id, project_id, service_id, segment_path, start_time, end_time, record_count, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        `seg_${ts}`, 
        project, 
        service, 
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
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
      });
    }

    const addCors = (res: Response) => {
      const headers = new Headers(res.headers);
      headers.set("Access-Control-Allow-Origin", "*");
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
        return addCors(new Response(JSON.stringify({ id, name: body.name }), { headers: { 'Content-Type': 'application/json' } }));
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
        await env.DB.prepare(`INSERT INTO services (id, project_id, name, type, created_at, updated_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .bind(servId, projectId, name, type || 'api', now, now, now).run();
        return addCors(new Response(JSON.stringify({ id: servId, project_id: projectId, name }), { headers: { 'Content-Type': 'application/json' } }));
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
       
       logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
       return addCors(new Response(JSON.stringify(logs), { headers: { 'Content-Type': 'application/json' } }));
    }

    // Ingestion API (Service to platform - can be authenticated via API keys or open for local dev)
    if (url.pathname === '/v1/logs' && request.method === 'POST') {
      try {
        const body: LogEvent = await request.json();
        const rawProj = typeof body.project === 'string' ? body.project.trim() : '';
        const rawServ = typeof body.service === 'string' ? body.service.trim() : '';
        
        if (!rawProj || !rawServ) {
          return addCors(new Response(JSON.stringify({ error: "Missing project or service" }), { status: 400 }));
        }

        const now = new Date().toISOString();

        // 1. Resolve project: lookup by exact id OR case-insensitive name
        let project = await env.DB.prepare(
          `SELECT id, organization_id, name FROM projects WHERE id = ? OR LOWER(name) = LOWER(?) LIMIT 1`
        ).bind(rawProj, rawProj).first<{ id: string; organization_id: string; name: string }>();

        let projId = project?.id;
        let orgId = project?.organization_id;

        if (!project) {
          // If no existing project matched, attach to active org or fallback to default workspace
          orgId = session?.session?.activeOrganizationId || 'org_default';
          projId = rawProj.toLowerCase().startsWith('proj_') ? rawProj : `proj_${Date.now()}`;
          
          await env.DB.prepare(`INSERT INTO organization (id, name, createdAt) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING`)
            .bind(orgId, 'Default Workspace', now).run();

          await env.DB.prepare(`INSERT INTO projects (id, organization_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`)
            .bind(projId, orgId, rawProj, 'Auto-registered project', now, now).run();
        }

        // 2. Resolve service: lookup under this project by exact id OR case-insensitive name
        let service = await env.DB.prepare(
          `SELECT id, name FROM services WHERE project_id = ? AND (id = ? OR LOWER(name) = LOWER(?)) LIMIT 1`
        ).bind(projId, rawServ, rawServ).first<{ id: string; name: string }>();

        let servId = service?.id;

        if (!service) {
          servId = rawServ.toLowerCase().startsWith('serv_') ? rawServ : `serv_${Date.now()}`;
          await env.DB.prepare(
            `INSERT INTO services (id, project_id, name, type, created_at, updated_at, last_seen_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?) 
             ON CONFLICT(id) DO UPDATE SET last_seen_at = excluded.last_seen_at`
          ).bind(servId, projId, rawServ, 'api', now, now, now).run();
        } else {
          await env.DB.prepare(`UPDATE services SET last_seen_at = ?, updated_at = ? WHERE id = ?`)
            .bind(now, now, servId).run();
        }

        // 3. Enrich log with canonical IDs so Durable Object indexes properly
        const enrichedLog: LogEvent = {
          ...body,
          project: projId!,
          service: servId!,
          timestamp: body.timestamp || now
        };

        const doId = env.REALTIME.idFromName(`${projId}:${servId}`);
        const stub = env.REALTIME.get(doId);
        
        const doReq = new Request(new URL('/ingest', request.url), {
          method: 'POST',
          body: JSON.stringify(enrichedLog),
          headers: { 'Content-Type': 'application/json' }
        });
        
        await stub.fetch(doReq);
        return addCors(new Response(JSON.stringify({ success: true, project_id: projId, service_id: servId }), {
          headers: { 'Content-Type': 'application/json' }
        }));
      } catch (e: any) {
        return addCors(new Response(JSON.stringify({ error: e.message }), { status: 500 }));
      }
    }
    
    // WebSockets connection from UI
    if (url.pathname === '/ws') {
      // NOTE: We could verify auth session here via URL tokens if we wanted to secure the websocket
      const projId = url.searchParams.get('project_id');
      const servId = url.searchParams.get('service_id');
      
      if (!projId || !servId) {
        return new Response("Missing project or service", { status: 400 });
      }
      
      const doId = env.REALTIME.idFromName(`${projId}:${servId}`);
      const stub = env.REALTIME.get(doId);
      
      return stub.fetch(new Request(url.toString(), {
        headers: request.headers
      }));
    }

    return addCors(new Response("Not found", { status: 404 }));
  }
};
