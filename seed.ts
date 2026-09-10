import http from 'http';

const sendLog = (log: any) => {
  const req = http.request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/v1/logs',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  req.write(JSON.stringify(log));
  req.end();
};

const seed = async () => {
  const logs = [
    {
      project: "arivulabs",
      service: "api",
      level: "info",
      event: "server.started",
      message: "API server started on port 8080",
      timestamp: new Date(Date.now() - 60000).toISOString(),
    },
    {
      project: "arivulabs",
      service: "api",
      level: "info",
      event: "request.completed",
      message: "Request completed",
      timestamp: new Date(Date.now() - 30000).toISOString(),
      request_id: "req_123",
      trace_id: "trace_abc",
      metadata: { method: "POST", path: "/chat", status: 200, latency_ms: 842 }
    },
    {
      project: "arivulabs",
      service: "agent",
      level: "info",
      event: "llm.call",
      message: "Generating response",
      timestamp: new Date(Date.now() - 25000).toISOString(),
      request_id: "req_123",
      trace_id: "trace_abc",
      metadata: { model: "gemini-3", inputTokens: 400 }
    },
    {
      project: "easy_gita",
      service: "redis",
      level: "warn",
      event: "memory.high",
      message: "Redis memory usage above 80%",
      timestamp: new Date().toISOString(),
    }
  ];

  for (const log of logs) {
    sendLog(log);
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log("Seeded");
};

seed();
