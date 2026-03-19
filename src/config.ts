export const config = {
  port: Number(process.env.PORT ?? 3000),
  quantityDecimals: Number(process.env.QUANTITY_DECIMALS ?? 3),
  amountDecimals: 2,
  weightTolerance: Number(process.env.WEIGHT_TOLERANCE ?? 0.0001),
  maxPortfolioItems: Number(process.env.MAX_PORTFOLIO_ITEMS ?? 1000),
  defaultPageSize: Number(process.env.DEFAULT_PAGE_SIZE ?? 25),
  maxPageSize: Number(process.env.MAX_PAGE_SIZE ?? 100),
  // Used only when the client does not supply a market price for a symbol.
  defaultPrices: {
    AAPL: 175.12,
    TSLA: 248.53,
    MSFT: 421.78,
    NVDA: 905.22,
    AMZN: 178.15
  } as Record<string, number>
};
