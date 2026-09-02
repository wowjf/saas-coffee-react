import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getOrderDisplayCode(orderId: string, length = 6) {
  const normalizedId = orderId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

  if (!normalizedId) {
    return "";
  }

  return normalizedId.slice(-Math.min(length, normalizedId.length));
}

export function matchesOrderCode(orderId: string, query: string) {
  const normalizedQuery = query.trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

  if (!normalizedQuery) {
    return false;
  }

  const normalizedId = orderId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return normalizedId.includes(normalizedQuery) || getOrderDisplayCode(orderId) === normalizedQuery;
}
