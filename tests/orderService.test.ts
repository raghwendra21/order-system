import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrder } from '../src/services/orderService';

test('creates an order using supplied market prices', () => {
  const order = createOrder({
    totalAmount: 100,
    orderType: 'BUY',
    modelPortfolio: [
      { symbol: 'AAPL', weight: 60, price: 200 },
      { symbol: 'TSLA', weight: 40, price: 50 }
    ]
  });

  assert.equal(order.breakdown[0].side, 'BUY');
  assert.equal(order.breakdown[0].amount, 60);
  assert.equal(order.breakdown[0].quantity, 0.3);
  assert.equal(order.breakdown[1].amount, 40);
  assert.equal(order.breakdown[1].quantity, 0.8);
});

test('accepts decimal weights that total 100 within tolerance', () => {
  const order = createOrder({
    totalAmount: 100,
    orderType: 'BUY',
    modelPortfolio: [
      { symbol: 'AAPL', weight: 33.33 },
      { symbol: 'TSLA', weight: 33.33 },
      { symbol: 'MSFT', weight: 33.34 }
    ]
  });

  assert.equal(order.breakdown.length, 3);
  assert.equal(order.breakdown[2].amount, 33.34);
});

test('moves execution to the next trading window when the current one has passed', () => {
  const order = createOrder(
    {
      totalAmount: 100,
      orderType: 'BUY',
      modelPortfolio: [
        { symbol: 'AAPL', weight: 60 },
        { symbol: 'TSLA', weight: 40 }
      ]
    },
    new Date('2026-03-18T10:45:00.000Z')
  );

  assert.equal(order.executionDate, '2026-03-19T04:00:00.000Z');
});

test('makes sell intent explicit on each breakdown item', () => {
  const order = createOrder({
    totalAmount: 100,
    orderType: 'SELL',
    modelPortfolio: [
      { symbol: 'AAPL', weight: 60, price: 200 },
      { symbol: 'TSLA', weight: 40, price: 50 }
    ]
  });

  assert.equal(order.breakdown[0].side, 'SELL');
  assert.equal(order.breakdown[1].side, 'SELL');
  assert.equal(order.breakdown[0].quantity, 0.3);
  assert.equal(order.breakdown[1].quantity, 0.8);
});

test('rejects portfolios whose weights are outside tolerance', () => {
  assert.throws(
    () =>
      createOrder({
        totalAmount: 100,
        orderType: 'BUY',
        modelPortfolio: [
          { symbol: 'AAPL', weight: 70 },
          { symbol: 'TSLA', weight: 20 }
        ]
      }),
    /weights must total 100/i
  );
});
