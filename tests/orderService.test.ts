import test from 'node:test';
import assert from 'node:assert/strict';
import Decimal from 'decimal.js';
import { createOrder, getExecutionDate } from '../src/services/orderService';
import { config } from '../src/config';

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

test('breakdown line amounts sum to rounded totalAmount (no penny drift)', () => {
  const order = createOrder({
    totalAmount: 1000,
    orderType: 'BUY',
    modelPortfolio: [
      { symbol: 'AAPL', weight: 33.33, price: 10 },
      { symbol: 'TSLA', weight: 33.33, price: 10 },
      { symbol: 'MSFT', weight: 33.34, price: 10 }
    ]
  });

  const sum = order.breakdown.reduce((acc, line) => acc.plus(line.amount), new Decimal(0));
  assert.equal(sum.toNumber(), order.totalAmount);
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

test('uses defaultPriceBase for unknown symbols when price is omitted', () => {
  const order = createOrder({
    totalAmount: 100,
    orderType: 'BUY',
    modelPortfolio: [{ symbol: 'ZZZZ', weight: 100 }]
  });

  assert.equal(order.breakdown[0].price, config.defaultPriceBase);
  assert.equal(order.breakdown[0].quantity, 1);
});

test('prefers defaultPrices map over defaultPriceBase when price omitted', () => {
  const order = createOrder({
    totalAmount: 100,
    orderType: 'BUY',
    modelPortfolio: [{ symbol: 'AAPL', weight: 100 }]
  });

  assert.equal(order.breakdown[0].price, config.defaultPrices.AAPL);
});

test('schedules same-day open when now is before market open (America/New_York)', () => {
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

  assert.equal(order.executionDate, '2026-03-18T13:30:00.000Z');
});

test('moves execution to the next trading day after the open when the session has started', () => {
  const order = createOrder(
    {
      totalAmount: 100,
      orderType: 'BUY',
      modelPortfolio: [
        { symbol: 'AAPL', weight: 60 },
        { symbol: 'TSLA', weight: 40 }
      ]
    },
    new Date('2026-03-18T16:00:00.000Z')
  );

  assert.equal(order.executionDate, '2026-03-19T13:30:00.000Z');
});

test('rolls weekend orders to Monday open', () => {
  const order = createOrder(
    {
      totalAmount: 100,
      orderType: 'BUY',
      modelPortfolio: [{ symbol: 'AAPL', weight: 100 }]
    },
    new Date('2026-03-21T15:00:00.000Z')
  );

  assert.equal(order.executionDate, '2026-03-23T13:30:00.000Z');
});

test('getExecutionDate matches createOrder execution instant', () => {
  const now = new Date('2026-03-20T20:00:00.000Z');
  const fromFn = getExecutionDate(now).toISOString();
  const fromOrder = createOrder(
    {
      totalAmount: 1,
      orderType: 'BUY',
      modelPortfolio: [{ symbol: 'AAPL', weight: 100, price: 1 }]
    },
    now
  ).executionDate;

  assert.equal(fromFn, fromOrder);
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

test('quantities use the same rounded amount as each line (half-up)', () => {
  const order = createOrder({
    totalAmount: 100,
    orderType: 'BUY',
    modelPortfolio: [{ symbol: 'AAPL', weight: 100, price: 3 }]
  });

  const expectedQty = new Decimal(order.breakdown[0].amount)
    .div(order.breakdown[0].price)
    .toDecimalPlaces(config.quantityDecimals, Decimal.ROUND_HALF_UP)
    .toNumber();

  assert.equal(order.breakdown[0].quantity, expectedQty);
});

test('rejects invalid orderType', () => {
  assert.throws(
    () =>
      createOrder({
        totalAmount: 1,
        orderType: 'HOLD' as 'BUY',
        modelPortfolio: [{ symbol: 'AAPL', weight: 100, price: 1 }]
      }),
    /orderType must be BUY or SELL/i
  );
});

test('rejects empty modelPortfolio', () => {
  assert.throws(
    () =>
      createOrder({
        totalAmount: 1,
        orderType: 'BUY',
        modelPortfolio: []
      }),
    /at least one security/i
  );
});

test('rejects missing symbol', () => {
  assert.throws(
    () =>
      createOrder({
        totalAmount: 1,
        orderType: 'BUY',
        modelPortfolio: [{ symbol: '', weight: 100, price: 1 }]
      }),
    /symbol is required/i
  );
});

test('rejects non-positive weight', () => {
  assert.throws(
    () =>
      createOrder({
        totalAmount: 1,
        orderType: 'BUY',
        modelPortfolio: [
          { symbol: 'AAPL', weight: 0, price: 1 },
          { symbol: 'TSLA', weight: 100, price: 1 }
        ]
      }),
    /weight must be a positive number/i
  );
});

test('rejects invalid optional price', () => {
  assert.throws(
    () =>
      createOrder({
        totalAmount: 1,
        orderType: 'BUY',
        modelPortfolio: [{ symbol: 'AAPL', weight: 100, price: -1 }]
      }),
    /price must be a positive number when provided/i
  );
});

test('rejects portfolio larger than maxPortfolioItems', () => {
  const many = Array.from({ length: config.maxPortfolioItems + 1 }, (_, i) => ({
    symbol: `S${i}`,
    weight: 100 / (config.maxPortfolioItems + 1),
    price: 1
  }));
  assert.throws(() => createOrder({ totalAmount: 1, orderType: 'BUY', modelPortfolio: many }), /limit/i);
});
