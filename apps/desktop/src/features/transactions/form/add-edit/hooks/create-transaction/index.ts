import { getDb } from "@/lib/db";
import { resolveContactId } from "@/shared/contacts/resolve-contact";
import type { TransactionFormOutput } from "../../schema";
import { createIncomeTransaction } from "./income";
import { createExpenseTransaction } from "./expense";
import { createTransferTransaction } from "./transfer";

export async function createTransaction(values: TransactionFormOutput): Promise<string> {
  const contactId = await resolveContactId(values.contact_name);
  const db = await getDb();

  if (values.type === "income") {
    return createIncomeTransaction({ db, contactId, values });
  }
  if (values.type === "expense") {
    return createExpenseTransaction({ db, contactId, values });
  }
  return createTransferTransaction({ db, contactId, values });
}
