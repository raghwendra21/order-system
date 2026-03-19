import Decimal from 'decimal.js';
import { randomUUID } from 'node:crypto';
import { config } from '../config';
import {
  CreateOrderInput,
  OrderBreakdownItem,
  PortfolioItemInput,
  StoredOrder
} from '../types';

function roundAmount(value: Decimal.Value): number {
  return new Decimal(value).toDecimalPlaces(config.amountDecimals).toNumber();
}

function getExecutionDate(now = new Date()): Date {
  const executionDate = new Date(now);
  executionDate.setHours(9, 30, 0, 0);

  // Keep moving forward until we land on the next tradable market window.
  while (
    executionDate.getDay() === 0 ||
    executionDate.getDay() === 6 ||
    executionDate <= now
  ) {
    executionDate.setDate(executionDate.getDate() + 1);
    executionDate.setHours(9, 30, 0, 0);
  }

  return executionDate;
}

function assertPortfolioWeights(portfolio: PortfolioItemInput[]): void {
  const totalWeight = portfolio.reduce(
    (sum, item) => sum.plus(item.weight),
    new Decimal(0)
  );

  // A small tolerance avoids rejecting valid decimal inputs due to representation noise.
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

function resolvePrice(item: PortfolioItemInput): number {
  const configuredPrice = config.defaultPrices[item.symbol.toUpperCase()];
  const price = item.price ?? configuredPrice;

  if (!price) {
    throw new Error(`No price available for symbol ${item.symbol}.`);
  }

  return price;
}

function buildBreakdown(input: CreateOrderInput): OrderBreakdownItem[] {
  let allocatedAmount = new Decimal(0);

  return input.modelPortfolio.map((item, index) => {
    const totalAmount = new Decimal(input.totalAmount);
    const isLastItem = index === input.modelPortfolio.length - 1;

    // The final item absorbs any rounding remainder so the full order amount stays consistent.
    const amount = isLastItem
      ? totalAmount.minus(allocatedAmount)
      : totalAmount.mul(item.weight).div(100).toDecimalPlaces(config.amountDecimals);

    allocatedAmount = allocatedAmount.plus(amount);

    const price = new Decimal(resolvePrice(item));
    const quantity = amount.div(price).toDecimalPlaces(config.quantityDecimals);

    return {
      // We keep quantity positive and make the intended action explicit via side.
      side: input.orderType,
      symbol: item.symbol.toUpperCase(),
      weight: item.weight,
      amount: roundAmount(amount),
      price: roundAmount(price),
      quantity: quantity.toNumber()
    };
  });
}

export function createOrder(input: CreateOrderInput, now = new Date()): StoredOrder {
  validateInput(input);

  return {
    id: randomUUID(),
    orderType: input.orderType,
    totalAmount: roundAmount(input.totalAmount),
    modelPortfolio: input.modelPortfolio.map((item) => ({
      symbol: item.symbol.toUpperCase(),
      weight: item.weight,
      ...(item.price !== undefined ? { price: roundAmount(item.price) } : {})
    })),
    breakdown: buildBreakdown(input),
    executionDate: getExecutionDate(now).toISOString(),
    createdAt: now.toISOString()
  };
}
