import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/server';
import { clearOrders } from '../src/store/orderStore';

test('creates an order and returns paginated history', async () => {
  clearOrders();

  const createResponse = await handleRequest(
    'POST',
    '/api/orders',
    JSON.stringify({
      totalAmount: 1000,
      orderType: 'BUY',
      modelPortfolio: [
        { symbol: 'AAPL', weight: 60, price: 210.35 },
        { symbol: 'TSLA', weight: 40 }
      ]
    })
  );

  assert.equal(createResponse.statusCode, 201);
  assert.equal(
    (createResponse.body as { data: { breakdown: Array<{ symbol: string }> } }).data.breakdown
      .length,
    2
  );

  const historyResponse = await handleRequest('GET', '/api/orders?page=1&pageSize=1');
  assert.equal(historyResponse.statusCode, 200);

  const history = historyResponse.body as {
    data: unknown[];
    pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
  };

  assert.equal(history.data.length, 1);
  assert.equal(history.pagination.page, 1);
  assert.equal(history.pagination.pageSize, 1);
  assert.equal(history.pagination.totalItems, 1);
  assert.equal(history.pagination.totalPages, 1);
});

test('returns a 400 for invalid json and a 422 for invalid pagination', async () => {
  clearOrders();

  const invalidJsonResponse = await handleRequest('POST', '/api/orders', '{');
  assert.equal(invalidJsonResponse.statusCode, 400);

  const invalidPageResponse = await handleRequest('GET', '/api/orders?page=0');
  assert.equal(invalidPageResponse.statusCode, 422);
});
