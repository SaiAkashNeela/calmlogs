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

  // Defensive Security Headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Serve documentation portal and landing website
  app.use('/docs', express.static(path.join(process.cwd(), 'docs')));
  app.get('/docs', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'docs', 'index.html'));
  });

  app.use('/website', express.static(path.join(process.cwd(), 'website')));
  app.get('/website', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'website', 'index.html'));
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
