import http, { IncomingMessage, ServerResponse } from 'node:http';
import { performance } from 'node:perf_hooks';
import { config } from './config';
import { createOrder } from './services/orderService';
import { getOrders, saveOrder } from './store/orderStore';
import { CreateOrderInput } from './types';

function sendJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body, null, 2));
}

function logResponse(method: string, url: string, statusCode: number, startedAt: number): void {
  const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
  console.log(`[HTTP] ${method} ${url} ${statusCode} ${durationMs}ms`);
}

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (value === null) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('Pagination parameters must be positive integers.');
  }

  return parsed;
}

export async function handleRequest(
  method: string,
  requestUrl: string,
  rawBody?: string
): Promise<{ statusCode: number; body: unknown }> {
  try {
    const url = new URL(requestUrl, 'http://localhost');

    if (method === 'GET' && url.pathname === '/health') {
      return { statusCode: 200, body: { status: 'ok' } };
    }

    if (method === 'GET' && url.pathname === '/api/orders') {
      const page = parsePositiveInteger(url.searchParams.get('page'), 1);
      const pageSize = parsePositiveInteger(
        url.searchParams.get('pageSize'),
        config.defaultPageSize
      );
      // History is paginated to avoid returning the full in-memory dataset on every read.
      return { statusCode: 200, body: getOrders(page, pageSize) };
    }

    if (method === 'POST' && url.pathname === '/api/orders') {
      if (!rawBody) {
        throw new Error('Request body is required.');
      }

      const input = JSON.parse(rawBody) as CreateOrderInput;
      const order = saveOrder(createOrder(input));
      return { statusCode: 201, body: { data: order } };
    }

    return { statusCode: 404, body: { error: 'Route not found.' } };
  } catch (error) {
    const message =
      error instanceof SyntaxError
        ? 'Request body must be valid JSON.'
        : error instanceof Error
          ? error.message
          : 'Unexpected error.';

    const statusCode = error instanceof SyntaxError ? 400 : 422;
    return { statusCode, body: { error: message } };
  }
}

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = chunks.length > 0 ? Buffer.concat(chunks).toString('utf8') : undefined;
  const result = await handleRequest(req.method ?? 'UNKNOWN', req.url ?? '/', rawBody);
  sendJson(res, result.statusCode, result.body);
}

export function createServer(): http.Server {
  return http.createServer(async (req, res) => {
    const startedAt = performance.now();

    try {
      await route(req, res);
    } finally {
      logResponse(req.method ?? 'UNKNOWN', req.url ?? '/', res.statusCode, startedAt);
    }
  });
}

export function startServer(): http.Server {
  const server = createServer();
  server.listen(config.port, () => {
    console.log(`[BOOT] Order API listening on port ${config.port}`);
    console.log(`[BOOT] Quantity decimals configured as ${config.quantityDecimals}`);
  });
  return server;
}
