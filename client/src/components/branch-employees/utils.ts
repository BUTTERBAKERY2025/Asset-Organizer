import { Badge } from "@/components/ui/badge";
import React from "react";

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "--";
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value) + " ريال";
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return "--";
  return new Intl.NumberFormat('en-US').format(value);
}

export function getStatusBadge(status: string): React.ReactElement {
  const variants: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    inactive: "bg-gray-100 text-gray-800",
    terminated: "bg-red-100 text-red-800",
    on_leave: "bg-yellow-100 text-yellow-800",
  };
  const labels: Record<string, string> = {
    active: "نشط",
    inactive: "غير نشط",
    terminated: "منتهي",
    on_leave: "في إجازة",
  };
  return React.createElement(Badge, { className: variants[status] || variants.active }, labels[status] || status);
}

export function getHealthBadge(status: string): React.ReactElement {
  const variants: Record<string, string> = {
    valid: "bg-green-100 text-green-800",
    expired: "bg-red-100 text-red-800",
    pending: "bg-yellow-100 text-yellow-800",
    none: "bg-gray-100 text-gray-800",
  };
  const labels: Record<string, string> = {
    valid: "ساري",
    expired: "منتهي",
    pending: "قيد التجديد",
    none: "لا يوجد",
  };
  return React.createElement(Badge, { className: variants[status] || variants.none }, labels[status] || status);
}

export function getHealthLabel(status: string): string {
  const labels: Record<string, string> = {
    valid: "ساري",
    expired: "منتهي",
    pending: "قيد التجديد",
    none: "لا يوجد",
  };
  return labels[status] || status;
}

export function generateEmployeeNumber(branchId: string, existingNumbers: string[]): string {
  const branchPrefix = branchId.substring(0, 3).toUpperCase();
  const year = new Date().getFullYear().toString().slice(-2);
  
  const branchNumbers = existingNumbers
    .filter(num => num?.startsWith(`${branchPrefix}-${year}-`))
    .map(num => parseInt(num.split('-')[2] || '0'))
    .filter(n => !isNaN(n));
  
  const nextNumber = branchNumbers.length > 0 ? Math.max(...branchNumbers) + 1 : 1;
  return `${branchPrefix}-${year}-${nextNumber.toString().padStart(4, '0')}`;
}
