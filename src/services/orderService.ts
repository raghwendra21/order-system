import Decimal from 'decimal.js';
import { DateTime } from 'luxon';
import { randomUUID } from 'node:crypto';
import { config } from '../config';
import {
  CreateOrderInput,
  OrderBreakdownItem,
  PortfolioItemInput,
  StoredOrder
} from '../types';

function roundAmount(value: Decimal.Value): number {
  return new Decimal(value).toDecimalPlaces(config.amountDecimals, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Next regular-session open at {@link config.marketOpenHour}:{@link config.marketOpenMinute}
 * in {@link config.marketTimezone}, strictly after `now`. Weekends are skipped.
 * Uses zone-local calendar arithmetic (Luxon) to avoid DST boundary bugs from
 * mixing local `Date#setHours` with UTC instants.
 */
export function getExecutionDate(now = new Date()): Date {
  const zone = config.marketTimezone;
  const instant = DateTime.fromMillis(now.getTime(), { zone });
  let candidate = instant.set({
    hour: config.marketOpenHour,
    minute: config.marketOpenMinute,
    second: 0,
    millisecond: 0
  });

  while (candidate.weekday === 6 || candidate.weekday === 7 || candidate <= instant) {
    candidate = candidate.plus({ days: 1 }).set({
      hour: config.marketOpenHour,
      minute: config.marketOpenMinute,
      second: 0,
      millisecond: 0
    });
  }

  return candidate.toUTC().toJSDate();
}

function assertPortfolioWeights(portfolio: PortfolioItemInput[]): void {
  const totalWeight = portfolio.reduce(
    (sum, item) => sum.plus(item.weight),
    new Decimal(0)
  );

  if (totalWeight.minus(100).abs().greaterThan(config.weightTolerance)) {
    throw new Error(
      `Model portfolio weights must total 100 within a tolerance of ${config.weightTolerance}.`
    );
  }
}

function validateInput(input: CreateOrderInput): void {
  if (!Number.isFinite(input.totalAmount) || input.totalAmount <= 0) {
    throw new Error('totalAmount must be a positive number.');
  }

  if (input.orderType !== 'BUY' && input.orderType !== 'SELL') {
    throw new Error('orderType must be BUY or SELL.');
  }

  if (!Array.isArray(input.modelPortfolio) || input.modelPortfolio.length === 0) {
    throw new Error('modelPortfolio must contain at least one security.');
  }

  if (input.modelPortfolio.length > config.maxPortfolioItems) {
    throw new Error(
      `modelPortfolio exceeds the supported limit of ${config.maxPortfolioItems} items.`
    );
  }

  input.modelPortfolio.forEach((item, index) => {
    if (!item.symbol || typeof item.symbol !== 'string') {
      throw new Error(`ModelPortfolio[${index}].symbol is required.`);
    }

    if (!Number.isFinite(item.weight) || item.weight <= 0) {
      throw new Error(`modelPortfolio[${index}].weight must be a positive number.`);
    }

    if (item.price !== undefined && (!Number.isFinite(item.price) || item.price <= 0)) {
      throw new Error(`modelPortfolio[${index}].price must be a positive number when provided.`);
    }
  });

  assertPortfolioWeights(input.modelPortfolio);
}

function resolvePrice(item: PortfolioItemInput): Decimal {
  const configured = config.defaultPrices[item.symbol.toUpperCase()];
  const raw = item.price ?? configured ?? config.defaultPriceBase;

  if (raw === undefined || raw === null || !Number.isFinite(Number(raw)) || Number(raw) <= 0) {
    throw new Error(`No price available for symbol ${item.symbol}.`);
  }

  return new Decimal(raw).toDecimalPlaces(config.amountDecimals, Decimal.ROUND_HALF_UP);
}

function buildBreakdown(input: CreateOrderInput, totalAmount: Decimal): OrderBreakdownItem[] {
  let allocatedAmount = new Decimal(0);
  const items = input.modelPortfolio;

  return items.map((item, index) => {
    const isLastItem = index === items.length - 1;

    const amount = isLastItem
      ? totalAmount.minus(allocatedAmount)
      : totalAmount.mul(item.weight).div(100).toDecimalPlaces(config.amountDecimals, Decimal.ROUND_HALF_UP);

    if (!isLastItem) {
      allocatedAmount = allocatedAmount.plus(amount);
    }

    const price = resolvePrice(item);
    const quantity = amount.div(price).toDecimalPlaces(config.quantityDecimals, Decimal.ROUND_HALF_UP);

    return {
      side: input.orderType,
      symbol: item.symbol.toUpperCase(),
      weight: item.weight,
      amount: amount.toNumber(),
      price: price.toNumber(),
      quantity: quantity.toNumber()
    };
  });
}

export function createOrder(input: CreateOrderInput, now = new Date()): StoredOrder {
  validateInput(input);

  const totalAmount = new Decimal(input.totalAmount).toDecimalPlaces(
    config.amountDecimals,
    Decimal.ROUND_HALF_UP
  );

  return {
    id: randomUUID(),
    orderType: input.orderType,
    totalAmount: totalAmount.toNumber(),
    modelPortfolio: input.modelPortfolio.map((item) => ({
      symbol: item.symbol.toUpperCase(),
      weight: item.weight,
      ...(item.price !== undefined ? { price: roundAmount(item.price) } : {})
    })),
    breakdown: buildBreakdown(input, totalAmount),
    executionDate: getExecutionDate(now).toISOString(),
    createdAt: now.toISOString()
  };
}
