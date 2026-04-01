function readPositiveNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  quantityDecimals: Number(process.env.QUANTITY_DECIMALS ?? 3),
  amountDecimals: 2,
  weightTolerance: Number(process.env.WEIGHT_TOLERANCE ?? 0.0001),
  maxPortfolioItems: Number(process.env.MAX_PORTFOLIO_ITEMS ?? 1000),
  defaultPageSize: Number(process.env.DEFAULT_PAGE_SIZE ?? 25),
  maxPageSize: Number(process.env.MAX_PAGE_SIZE ?? 100),
  /** IANA zone for US equity regular session boundaries (DST-safe). */
  marketTimezone: process.env.MARKET_TIMEZONE ?? 'America/New_York',
  marketOpenHour: Number(process.env.MARKET_OPEN_HOUR ?? 9),
  marketOpenMinute: Number(process.env.MARKET_OPEN_MINUTE ?? 30),
  /** Regular session close (informational; scheduling uses next open after `now`). */
  marketCloseHour: Number(process.env.MARKET_CLOSE_HOUR ?? 16),
  marketCloseMinute: Number(process.env.MARKET_CLOSE_MINUTE ?? 0),
  /**
   * When the client omits `price` and the symbol is not in `defaultPrices`,
   * this value is used (default 100). Override with `DEFAULT_PRICE_BASE`.
   */
  defaultPriceBase: readPositiveNumber(process.env.DEFAULT_PRICE_BASE, 100),
  // Used only when the client does not supply a market price for a symbol.
  defaultPrices: {
    AAPL: 175.12,
    TSLA: 248.53,
    MSFT: 421.78,
    NVDA: 905.22,
    AMZN: 178.15
  } as Record<string, number>
};
