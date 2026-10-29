import type { Db } from "./types";
import type { ContactDebtSummary } from "./contact-summary";
import type { ContactDebtRow } from "./contact-debts";
import type { DebtPaymentRow } from "./debt-payments";
import type { DebtListRow } from "./debts-list";

export type FakeContactRow = { id: string; name: string };
export type FakeDebtRow = {
  id: string;
  type: "receivable" | "payable";
  contact_id: string | null;
  amount: number;
  account_id: string | null;
  account_name?: string | null;
  transaction_id: string | null;
  status: "ongoing" | "paid" | "written_off";
  note?: string | null;
  date: string;
};
export type FakeDebtPaymentRow = {
  id: string;
  debt_id: string;
  amount: number;
  account_id: string | null;
  account_name?: string | null;
  transaction_id: string | null;
  note?: string | null;
  date: string;
};

// Fake db KHUSUS untuk getContactSummary/getContactDebts/getDebtPayments
// (contact-summary.test.ts, contact-debts.test.ts, debt-payments.test.ts)
// — query-query ini satu statement SQL besar dengan banyak subquery
// aggregate, tidak realistis dipalsukan dengan pattern-matching string
// seperti fake db di create-fake-db.ts (dipakai modul apply-debt-
// transaction/edit/delete). Di sini hasil dihitung langsung dari seed
// data di JS, meniru SEMANTIK SQL-nya (bukan parsing SQL), supaya test
// tetap menguji "apakah logic agregasinya benar" tanpa coupling ke
// detail penulisan query.
export function createContactsFakeDb(
  seed: {
    contacts?: FakeContactRow[];
    debts?: FakeDebtRow[];
    debtPayments?: FakeDebtPaymentRow[];
  } = {}
) {
  const contacts = seed.contacts ?? [];
  const debts: FakeDebtRow[] = seed.debts ?? [];
  const debtPayments: FakeDebtPaymentRow[] = seed.debtPayments ?? [];

  function remaining(debt: FakeDebtRow): number {
    const paid = debtPayments.filter((p) => p.debt_id === debt.id).reduce((sum, p) => sum + p.amount, 0);
    return debt.amount - paid;
  }

  const db: Db = {
    async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
      if (sql.startsWith("SELECT name FROM contacts WHERE id")) {
        const [id] = params as [string];
        const contact = contacts.find((c) => c.id === id);
        return (contact ? { name: contact.name } : null) as T | null;
      }
      throw new Error(`Fake db.getFirstAsync tidak mengenali query: ${sql}`);
    },
    async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      if (sql.includes("FROM contacts") && sql.includes("receivable_active")) {
        const rows: ContactDebtSummary[] = contacts
          .filter((contact) => debts.some((d) => d.contact_id === contact.id))
          .map((contact) => {
            const ongoing = (type: "receivable" | "payable") =>
              debts.filter((d) => d.contact_id === contact.id && d.type === type && d.status === "ongoing");
            const active = (type: "receivable" | "payable") =>
              ongoing(type).reduce((sum, d) => sum + d.amount, 0);
            const paidOf = (type: "receivable" | "payable") =>
              ongoing(type).reduce(
                (sum, d) => sum + debtPayments.filter((p) => p.debt_id === d.id).reduce((s, p) => s + p.amount, 0),
                0
              );
            const remainingOf = (type: "receivable" | "payable") =>
              ongoing(type).reduce((sum, d) => sum + remaining(d), 0);

            return {
              contact_id: contact.id,
              contact_name: contact.name,
              receivable_active: active("receivable"),
              receivable_paid: paidOf("receivable"),
              receivable_remaining: remainingOf("receivable"),
              payable_active: active("payable"),
              payable_paid: paidOf("payable"),
              payable_remaining: remainingOf("payable"),
            };
          })
          .sort((a, b) => a.contact_name.localeCompare(b.contact_name));
        return rows as T[];
      }
      if (sql.includes("FROM debts") && sql.includes("LEFT JOIN contacts")) {
        const rows: DebtListRow[] = debts
          .map((d) => ({
            id: d.id,
            type: d.type,
            contact_id: d.contact_id,
            contact_name: contacts.find((c) => c.id === d.contact_id)?.name ?? null,
            amount: d.amount,
            account_id: d.account_id,
            account_name: d.account_name ?? null,
            transaction_id: d.transaction_id,
            status: d.status,
            note: d.note ?? null,
            date: d.date,
            remaining: remaining(d),
          }))
          .sort((a, b) => (a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)));
        return rows as T[];
      }
      if (sql.includes("FROM debts") && sql.includes("LEFT JOIN accounts") && sql.includes("account_name")) {
        const [contactId] = params as [string];
        const rows: ContactDebtRow[] = debts
          .filter((d) => d.contact_id === contactId)
          .map((d) => ({
            id: d.id,
            type: d.type,
            contact_id: d.contact_id,
            amount: d.amount,
            account_id: d.account_id,
            account_name: d.account_name ?? null,
            transaction_id: d.transaction_id,
            status: d.status,
            note: d.note ?? null,
            date: d.date,
            remaining: remaining(d),
          }))
          .sort((a, b) => (a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)));
        return rows as T[];
      }
      if (sql.includes("FROM debt_payments") && sql.includes("LEFT JOIN accounts")) {
        const [debtId] = params as [string];
        const rows: DebtPaymentRow[] = debtPayments
          .filter((p) => p.debt_id === debtId)
          .map((p) => ({
            id: p.id,
            debt_id: p.debt_id,
            amount: p.amount,
            account_id: p.account_id,
            account_name: p.account_name ?? null,
            transaction_id: p.transaction_id,
            note: p.note ?? null,
            date: p.date,
          }))
          .sort((a, b) => (a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)));
        return rows as T[];
      }
      throw new Error(`Fake db.getAllAsync tidak mengenali query: ${sql}`);
    },
    async runAsync(): Promise<unknown> {
      throw new Error("Fake db.runAsync tidak dipakai di query read-only ini.");
    },
  } as unknown as Db;

  return { db, contacts, debts, debtPayments };
}
