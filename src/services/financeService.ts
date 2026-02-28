import { desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { transactions, type Transaction } from "../db/schema";

// ─── Types ────────────────────────────────────────────
export type TransactionType = "income" | "expense";

export interface MonthSection {
  title: string; // "Fevereiro 2026"
  month: string; // "2026-02"
  data: Transaction[];
}

export interface MonthlyBalance {
  month: string; // "Fev"
  fullMonth: string; // "2026-02"
  balance: number; // centavos (pode ser negativo)
}

// ─── CRUD ─────────────────────────────────────────────

export async function getAllTransactions(): Promise<Transaction[]> {
  return db.select().from(transactions).orderBy(desc(transactions.createdAt)).all();
}

export async function getTransactionById(id: number): Promise<Transaction | undefined> {
  const results = await db.select().from(transactions).where(eq(transactions.id, id));
  return results[0];
}

export async function createTransaction(
  title: string,
  type: TransactionType,
  amount: number = 0,
  isAmountUndefined: boolean = false,
  description: string = "",
): Promise<Transaction> {
  const now = new Date().toISOString();
  const result = await db
    .insert(transactions)
    .values({
      title,
      description,
      amount,
      type,
      isAmountUndefined: isAmountUndefined ? 1 : 0,
      createdAt: now,
    })
    .returning();
  return result[0]!;
}

export async function updateTransaction(
  id: number,
  data: {
    title?: string;
    description?: string;
    amount?: number;
    type?: TransactionType;
    isAmountUndefined?: boolean;
  },
): Promise<void> {
  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.amount !== undefined) updateData.amount = data.amount;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.isAmountUndefined !== undefined)
    updateData.isAmountUndefined = data.isAmountUndefined ? 1 : 0;

  await db.update(transactions).set(updateData).where(eq(transactions.id, id));
}

export async function deleteTransaction(id: number): Promise<void> {
  await db.delete(transactions).where(eq(transactions.id, id));
}

// ─── Helpers ──────────────────────────────────────────

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const SHORT_MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function getMonthKey(isoDate: string): string {
  return isoDate.substring(0, 7); // "2026-02"
}

function formatMonthTitle(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const monthIndex = parseInt(month, 10) - 1;
  return `${MONTH_NAMES[monthIndex]} de ${year}`;
}

function formatShortMonth(monthKey: string): string {
  const month = parseInt(monthKey.split("-")[1], 10) - 1;
  return SHORT_MONTH_NAMES[month];
}

export function getTransactionsGroupedByMonth(allTransactions: Transaction[]): MonthSection[] {
  const map = new Map<string, Transaction[]>();

  for (const t of allTransactions) {
    const key = getMonthKey(t.createdAt);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }

  // Sort months descending
  const sortedKeys = [...map.keys()].sort((a, b) => b.localeCompare(a));

  return sortedKeys.map((key) => ({
    title: formatMonthTitle(key),
    month: key,
    data: map.get(key)!,
  }));
}

export function getMonthlyBalances(allTransactions: Transaction[]): MonthlyBalance[] {
  const map = new Map<string, number>();

  for (const t of allTransactions) {
    const key = getMonthKey(t.createdAt);
    if (!map.has(key)) map.set(key, 0);
    const sign = t.type === "income" ? 1 : -1;
    const amount = t.isAmountUndefined ? 0 : t.amount;
    map.set(key, map.get(key)! + sign * amount);
  }

  // Sort months ascending for chart chronological order
  const sortedKeys = [...map.keys()].sort((a, b) => a.localeCompare(b));

  return sortedKeys.map((key) => ({
    month: formatShortMonth(key),
    fullMonth: key,
    balance: map.get(key)!,
  }));
}
