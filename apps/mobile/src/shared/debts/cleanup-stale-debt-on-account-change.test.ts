import { describe, expect, it } from "vitest";
import { cleanupStaleDebtOnAccountChange } from "./cleanup-stale-debt-on-account-change";
import { createFakeDb, type FakeAccountRow, type FakeDebtRow } from "./create-fake-db";

const CASH: FakeAccountRow = { id: "cash-1", account_type: "cash" };
const CASH_2: FakeAccountRow = { id: "cash-2", account_type: "cash" };
const DEBT: FakeAccountRow = { id: "debt-1", account_type: "debt" };

describe("cleanupStaleDebtOnAccountChange", () => {
  it("akun tidak berubah: no-op, tidak menyentuh debts", async () => {
    const seedDebts: FakeDebtRow[] = [
      {
        id: "debt-row-1",
        type: "payable",
        contact_id: "contact-10",
        amount: 40000,
        account_id: "debt-1",
        transaction_id: "tx-42",
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const { db, debts } = createFakeDb({ accounts: [CASH, DEBT], debts: seedDebts });

    await cleanupStaleDebtOnAccountChange(
      db,
      "tx-42",
      { accountId: "cash-1", transferAccountId: "debt-1" },
      { accountId: "cash-1", transferAccountId: "debt-1" }
    );

    expect(debts[0].transaction_id).toBe("tx-42");
  });

  it("akun berubah tapi masih sama-sama tidak involve debt: no-op", async () => {
    const { db, debts } = createFakeDb({ accounts: [CASH, CASH_2] });

    await cleanupStaleDebtOnAccountChange(
      db,
      "tx-42",
      { accountId: "cash-1", transferAccountId: null },
      { accountId: "cash-2", transferAccountId: null }
    );

    expect(debts).toHaveLength(0);
  });

  it("akun berubah dari involve debt ke TIDAK involve debt: detach (transaction_id SET NULL, debt tetap ada)", async () => {
    const seedDebts: FakeDebtRow[] = [
      {
        id: "debt-row-1",
        type: "payable",
        contact_id: "contact-10",
        amount: 40000,
        account_id: "debt-1",
        transaction_id: "tx-42",
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const { db, debts } = createFakeDb({ accounts: [CASH, CASH_2, DEBT], debts: seedDebts });

    await cleanupStaleDebtOnAccountChange(
      db,
      "tx-42",
      { accountId: "cash-1", transferAccountId: "debt-1" },
      { accountId: "cash-1", transferAccountId: "cash-2" }
    );

    expect(debts).toHaveLength(1);
    expect(debts[0].transaction_id).toBeNull();
    expect(debts[0].amount).toBe(40000);
  });

  it("akun berubah dan masih sama-sama involve debt: no-op (biarkan routing edit yang urus)", async () => {
    const seedDebts: FakeDebtRow[] = [
      {
        id: "debt-row-1",
        type: "payable",
        contact_id: "contact-10",
        amount: 40000,
        account_id: "debt-1",
        transaction_id: "tx-42",
        status: "ongoing",
        date: "2026-01-01",
      },
    ];
    const { db, debts } = createFakeDb({ accounts: [CASH, DEBT], debts: seedDebts });

    await cleanupStaleDebtOnAccountChange(
      db,
      "tx-42",
      { accountId: "cash-1", transferAccountId: "debt-1" },
      { accountId: "debt-1", transferAccountId: "cash-1" }
    );

    expect(debts[0].transaction_id).toBe("tx-42");
  });
});
