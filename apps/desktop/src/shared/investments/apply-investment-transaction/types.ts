import type { getDb } from "@/lib/db";

export type Db = Awaited<ReturnType<typeof getDb>>;

export type TouchedInvestmentRows = {
  investmentPurchaseIds: string[];
  deletedInvestmentPurchaseIds: string[];
};

export const none: TouchedInvestmentRows = { investmentPurchaseIds: [], deletedInvestmentPurchaseIds: [] };
