import type { Express, Request, Response } from "express";

export function registerBatchRoute(app: Express) {
  app.post("/api/batch", async (req: Request, res: Response) => {
    try {
      if (!(req as any).session?.userId) {
        return res.status(401).json({ error: "غير مصرح" });
      }
      
      const { requests } = req.body;
      
      if (!Array.isArray(requests) || requests.length === 0) {
        return res.status(400).json({ error: "requests array is required" });
      }

      if (requests.length > 20) {
        return res.status(400).json({ error: "Maximum 20 requests per batch" });
      }

      const results = await Promise.all(
        requests.map(async (apiReq: { url: string; method?: string }) => {
          const url = apiReq.url;
          const method = (apiReq.method || "GET").toUpperCase();

          if (method !== "GET") {
            return { url, status: 400, data: { error: "Only GET requests allowed in batch" } };
          }

          if (!url.startsWith("/api/")) {
            return { url, status: 400, data: { error: "Only /api/ urls allowed" } };
          }

          try {
            const internalRes = await new Promise<{ status: number; data: any }>((resolve) => {
              const mockRes = {
                statusCode: 200,
                _headers: {} as Record<string, string>,
                _data: null as any,
                status(code: number) { this.statusCode = code; return this; },
                json(data: any) { this._data = data; resolve({ status: this.statusCode, data }); return this; },
                send(data: any) { this._data = data; resolve({ status: this.statusCode, data }); return this; },
                set(key: string, val: string) { this._headers[key] = val; return this; },
                setHeader(key: string, val: string) { this._headers[key] = val; return this; },
                getHeader(key: string) { return this._headers[key]; },
                get(key: string) { return this._headers[key]; },
                headersSent: false,
                on() { return this; },
                once() { return this; },
                emit() { return false; },
                end(data?: any) { resolve({ status: this.statusCode, data: this._data || data }); return this; },
                write() { return true; },
                removeListener() { return this; },
              };

              const mockReq = Object.create(req);
              const parsedUrl = new URL(url, `http://${req.headers.host || 'localhost'}`);
              mockReq.method = "GET";
              mockReq.url = url;
              mockReq.path = parsedUrl.pathname;
              mockReq.originalUrl = url;
              mockReq.query = Object.fromEntries(parsedUrl.searchParams.entries());
              mockReq.params = {};
              mockReq.body = undefined;

              (app as any).handle(mockReq, mockRes as any, (err: any) => {
                if (err) {
                  resolve({ status: 500, data: { error: err.message } });
                } else {
                  resolve({ status: 404, data: { error: "Not found" } });
                }
              });
            });
            return { url, ...internalRes };
          } catch (err: any) {
            return { url, status: 500, data: { error: err.message } };
          }
        })
      );

      res.json({ results });
    } catch (error: any) {
      console.error("Batch API error:", error);
      res.status(500).json({ error: "Batch request failed" });
    }
  });
}
