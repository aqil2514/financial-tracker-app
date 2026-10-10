import { getDb } from "@/lib/db";

import { applyInvestmentAccountRow } from "./apply-investment-account-row";
import { applyLabelJunctionRow } from "./apply-label-junction-row";
import { applyRow } from "./apply-row";
import type { SyncResponse } from "./types";
import { upsertAccount } from "./upsert-account";
import { upsertAccountGroup } from "./upsert-account-group";
import { upsertCategory } from "./upsert-category";
import { upsertContact } from "./upsert-contact";
import { upsertDebt } from "./upsert-debt";
import { upsertDebtPayment } from "./upsert-debt-payment";
import { upsertInvestmentPurchase } from "./upsert-investment-purchase";
import { upsertInvestmentSale } from "./upsert-investment-sale";
import { upsertLabel } from "./upsert-label";
import { upsertTransaction } from "./upsert-transaction";

export async function applySyncResponse(response: SyncResponse): Promise<void> {
  const db = await getDb();

  for (const row of response.accountGroups) await applyRow(db, "account_groups", row, upsertAccountGroup);
  for (const row of response.categories) await applyRow(db, "categories", row, upsertCategory);
  for (const row of response.contacts) await applyRow(db, "contacts", row, upsertContact);
  for (const row of response.accounts) await applyRow(db, "accounts", row, upsertAccount);
  for (const row of response.transactions) await applyRow(db, "transactions", row, upsertTransaction);
  for (const row of response.debts) await applyRow(db, "debts", row, upsertDebt);
  for (const row of response.debtPayments) await applyRow(db, "debt_payments", row, upsertDebtPayment);

  for (const row of response.investmentAccounts) await applyInvestmentAccountRow(db, row);
  for (const row of response.investmentPurchases) {
    await applyRow(db, "investment_purchases", row, upsertInvestmentPurchase);
  }
  for (const row of response.investmentSales) {
    await applyRow(db, "investment_sales", row, upsertInvestmentSale);
  }

  for (const row of response.labels) await applyRow(db, "labels", row, upsertLabel);
  for (const row of response.transactionLabels) {
    await applyLabelJunctionRow(db, "transaction_labels", "transaction_id", {
      ...row,
      entityId: row.transactionId,
    });
  }
  for (const row of response.categoryLabels) {
    await applyLabelJunctionRow(db, "category_labels", "category_id", {
      ...row,
      entityId: row.categoryId,
    });
  }
  for (const row of response.accountLabels) {
    await applyLabelJunctionRow(db, "account_labels", "account_id", {
      ...row,
      entityId: row.accountId,
    });
  }
}
