import { getDb } from "@/lib/db";
import { resolveContactId } from "@/shared/contacts/resolve-contact";
import { assertForexTransactionSupported } from "@/shared/forex/assert-forex-transaction-supported";
import type { TransactionFormOutput } from "../../schema";
import { createIncomeTransaction } from "./income";
import { createExpenseTransaction } from "./expense";
import { createTransferTransaction } from "./transfer";

export async function createTransaction(values: TransactionFormOutput): Promise<string> {
  const contactId = await resolveContactId(values.contact_name);
  const db = await getDb();

  await assertForexTransactionSupported(db, [
    values.account_id,
    values.type === "transfer" ? values.transfer_account_id : null,
  ]);

  if (values.type === "income") {
    return createIncomeTransaction({ db, contactId, values });
  }
  if (values.type === "expense") {
    return createExpenseTransaction({ db, contactId, values });
  }
  return createTransferTransaction({ db, contactId, values });
}
