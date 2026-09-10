import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createProxyMiddleware } from "http-proxy-middleware";

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  // Proxy API and WebSockets to Cloudflare Wrangler Dev (port 8787)
  const wranglerProxy = createProxyMiddleware({
    target: "http://127.0.0.1:8787",
    changeOrigin: true,
    ws: true,
  });

  app.use('/api', (req, res, next) => {
    req.url = '/api' + req.url;
    wranglerProxy(req, res, next);
  });
  app.use('/v1', (req, res, next) => {
    req.url = '/v1' + req.url;
    wranglerProxy(req, res, next);
  });
  app.use('/ws', (req, res, next) => {
    req.url = '/ws' + req.url;
    wranglerProxy(req, res, next);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://localhost:${PORT}`);
  });
}

startServer();
