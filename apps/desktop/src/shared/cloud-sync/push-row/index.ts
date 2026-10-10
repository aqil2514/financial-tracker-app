import type { CloudSyncCredentials, PushUpsertResult } from "../worker-client";
import type { QueueableTable } from "../push-queue";
import { pushAccountGroupRow } from "./push-account-group-row";
import { pushCategoryRow } from "./push-category-row";
import { pushContactRow } from "./push-contact-row";
import { pushAccountRow } from "./push-account-row";
import { pushTransactionRow } from "./push-transaction-row";
import { pushDebtRow } from "./push-debt-row";
import { pushDebtPaymentRow } from "./push-debt-payment-row";
import { pushInvestmentAccountRow } from "./push-investment-account-row";
import { pushInvestmentPurchaseRow } from "./push-investment-purchase-row";
import { pushInvestmentSaleRow } from "./push-investment-sale-row";
import { pushAttachmentRow } from "./push-attachment-row";
import { pushLabelRow } from "./push-label-row";
import { pushLabelJunctionRow } from "./push-label-junction-row";

export async function pushRowPayload(
  creds: CloudSyncCredentials,
  table: QueueableTable,
  id: string
): Promise<PushUpsertResult | null> {
  switch (table) {
    case "account_groups":
      return pushAccountGroupRow(creds, id);
    case "categories":
      return pushCategoryRow(creds, id);
    case "contacts":
      return pushContactRow(creds, id);
    case "accounts":
      return pushAccountRow(creds, id);
    case "transactions":
      return pushTransactionRow(creds, id);
    case "debts":
      return pushDebtRow(creds, id);
    case "debt_payments":
      return pushDebtPaymentRow(creds, id);
    case "investment_accounts":
      return pushInvestmentAccountRow(creds, id);
    case "investment_purchases":
      return pushInvestmentPurchaseRow(creds, id);
    case "investment_sales":
      return pushInvestmentSaleRow(creds, id);
    case "transaction_attachments":
      return pushAttachmentRow(creds, id);
    case "labels":
      return pushLabelRow(creds, id);
    case "transaction_labels":
    case "category_labels":
    case "account_labels":
      return pushLabelJunctionRow(creds, table, id);
  }
}
