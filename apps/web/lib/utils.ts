import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: string | number | null | undefined): string {
  if (!value) return '0 kr';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '0 kr';
  return `${numValue.toLocaleString('sv-SE')} kr`;
}

export function formatMinutes(value: string | number | null | undefined): string {
  if (!value) return '0 min';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '0 min';
  return `${numValue.toFixed(1)} min`;
}
