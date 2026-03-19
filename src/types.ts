export type OrderType = 'BUY' | 'SELL';

export interface PortfolioItemInput {
  symbol: string;
  weight: number;
  price?: number;
}

export interface CreateOrderInput {
  totalAmount: number;
  orderType: OrderType;
  modelPortfolio: PortfolioItemInput[];
}

export interface OrderBreakdownItem {
  side: OrderType;
  symbol: string;
  weight: number;
  amount: number;
  price: number;
  quantity: number;
}

export interface StoredOrder {
  id: string;
  orderType: OrderType;
  totalAmount: number;
  modelPortfolio: PortfolioItemInput[];
  breakdown: OrderBreakdownItem[];
  executionDate: string;
  createdAt: string;
}

export interface OrderHistoryPage {
  data: StoredOrder[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
