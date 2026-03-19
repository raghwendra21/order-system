import { OrderHistoryPage, StoredOrder } from '../types';
import { config } from '../config';

const orders: StoredOrder[] = [];

export function saveOrder(order: StoredOrder): StoredOrder {
  orders.unshift(order);
  return order;
}

export function getOrders(page = 1, pageSize = config.defaultPageSize): OrderHistoryPage {
  const normalizedPage = Math.max(1, Math.trunc(page));
  const normalizedPageSize = Math.min(
    config.maxPageSize,
    Math.max(1, Math.trunc(pageSize))
  );
  const totalItems = orders.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / normalizedPageSize));
  const startIndex = (normalizedPage - 1) * normalizedPageSize;

  return {
    // Slice keeps history reads bounded even when the in-memory store grows.
    data: orders.slice(startIndex, startIndex + normalizedPageSize),
    pagination: {
      page: normalizedPage,
      pageSize: normalizedPageSize,
      totalItems,
      totalPages
    }
  };
}

export function clearOrders(): void {
  orders.length = 0;
}
