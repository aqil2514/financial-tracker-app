import { describe, expect, it } from "vitest";

import {
  applyDirectThirdPartyTransaction,
  applyThirdPartyTransfer,
  detachThirdPartyFundsForDeletedTransaction,
  InsufficientThirdPartyFundError,
} from "./index";

type ThirdPartyFundRow = {
  id: string;
  account_id: string;
  contact_id: string;
  transaction_id: string | null;
  direction: "in" | "out";
  amount: number;
  date: string;
  note: string | null;
};

function createFakeDb(seed: { rows?: ThirdPartyFundRow[] } = {}) {
  const rows: ThirdPartyFundRow[] = seed.rows ?? [];

  const db = {
    async select<T>(sql: string, params: unknown[] = []): Promise<T> {
      if (sql.includes("SUM(CASE WHEN direction")) {
        const [accountId, contactId] = params as [string, string];
        const remaining = rows
          .filter((r) => r.account_id === accountId && r.contact_id === contactId)
          .reduce((sum, r) => sum + (r.direction === "in" ? r.amount : -r.amount), 0);
        return [{ remaining }] as T;
      }
      if (sql.startsWith("SELECT id FROM third_party_funds WHERE transaction_id")) {
        const [transactionId] = params as [string];
        return rows.filter((r) => r.transaction_id === transactionId).map((r) => ({ id: r.id })) as T;
      }
      throw new Error(`Fake db.select tidak mengenali query: ${sql}`);
    },
    async execute(sql: string, params: unknown[] = []): Promise<{ lastInsertId?: number }> {
      if (sql.startsWith("INSERT INTO third_party_funds")) {
        const [id, accountId, contactId, transactionId, direction, amount, date, note] = params as [
          string,
          string,
          string,
          string | null,
          "in" | "out",
          number,
          string,
          string | null,
        ];
        rows.push({ id, account_id: accountId, contact_id: contactId, transaction_id: transactionId, direction, amount, date, note });
        return {};
      }
      if (sql.startsWith("DELETE FROM third_party_funds WHERE transaction_id")) {
        const [transactionId] = params as [string];
        for (let i = rows.length - 1; i >= 0; i--) {
          if (rows[i].transaction_id === transactionId) rows.splice(i, 1);
        }
        return {};
      }
      throw new Error(`Fake db.execute tidak mengenali query: ${sql}`);
    },
  };

  return { db, rows };
}

describe("applyDirectThirdPartyTransaction", () => {
  it("income (titip) membuat baris direction 'in'", async () => {
    const { db, rows } = createFakeDb();

    const result = await applyDirectThirdPartyTransaction({
      db: db as never,
      transactionId: "tx-1",
      type: "income",
      accountId: "account-1",
      contactId: "contact-10",
      amount: 100000,
      date: "2026-10-21",
      note: "Titip tabungan",
    });

    expect(rows).toEqual([
      {
        id: expect.any(String),
        account_id: "account-1",
        contact_id: "contact-10",
        transaction_id: "tx-1",
        direction: "in",
        amount: 100000,
        date: "2026-10-21",
        note: "Titip tabungan",
      },
    ]);
    expect(result.thirdPartyFundIds).toHaveLength(1);
  });

  it("note default null kalau tidak dioper", async () => {
    const { db, rows } = createFakeDb();

    await applyDirectThirdPartyTransaction({
      db: db as never,
      transactionId: "tx-1",
      type: "income",
      accountId: "account-1",
      contactId: "contact-10",
      amount: 100000,
      date: "2026-10-21",
    });

    expect(rows[0].note).toBeNull();
  });

  it("expense (ambil) sebagian dari titipan membuat baris direction 'out'", async () => {
    const seedRows: ThirdPartyFundRow[] = [
      { id: "fund-1", account_id: "account-1", contact_id: "contact-10", transaction_id: "tx-100", direction: "in", amount: 100000, date: "2026-10-17", note: null },
    ];
    const { db, rows } = createFakeDb({ rows: seedRows });

    await applyDirectThirdPartyTransaction({
      db: db as never,
      transactionId: "tx-200",
      type: "expense",
      accountId: "account-1",
      contactId: "contact-10",
      amount: 40000,
      date: "2026-10-21",
    });

    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({
      id: expect.any(String),
      account_id: "account-1",
      contact_id: "contact-10",
      transaction_id: "tx-200",
      direction: "out",
      amount: 40000,
      date: "2026-10-21",
      note: null,
    });
  });

  it("menolak expense (ambil) yang melebihi sisa titipan", async () => {
    const seedRows: ThirdPartyFundRow[] = [
      { id: "fund-1", account_id: "account-1", contact_id: "contact-10", transaction_id: "tx-100", direction: "in", amount: 100000, date: "2026-10-17", note: null },
    ];
    const { db } = createFakeDb({ rows: seedRows });

    await expect(
      applyDirectThirdPartyTransaction({
        db: db as never,
        transactionId: "tx-200",
        type: "expense",
        accountId: "account-1",
        contactId: "contact-10",
        amount: 150000,
        date: "2026-10-21",
      })
    ).rejects.toThrow(InsufficientThirdPartyFundError);
  });

  it("sisa titipan dihitung per kontak, bukan per akun — kontak lain tidak ikut tervalidasi", async () => {
    const seedRows: ThirdPartyFundRow[] = [
      { id: "fund-1", account_id: "account-1", contact_id: "contact-10", transaction_id: "tx-100", direction: "in", amount: 100000, date: "2026-10-17", note: null },
    ];
    const { db } = createFakeDb({ rows: seedRows });

    await expect(
      applyDirectThirdPartyTransaction({
        db: db as never,
        transactionId: "tx-200",
        type: "expense",
        accountId: "account-1",
        contactId: "contact-99",
        amount: 1000,
        date: "2026-10-21",
      })
    ).rejects.toThrow(InsufficientThirdPartyFundError);
  });
});

describe("applyThirdPartyTransfer", () => {
  it("pindah tempat (akun beda, kontak sama) membuat baris out+in dengan kontak sama", async () => {
    const seedRows: ThirdPartyFundRow[] = [
      { id: "fund-1", account_id: "account-tunai", contact_id: "contact-10", transaction_id: "tx-100", direction: "in", amount: 100000, date: "2026-10-17", note: null },
    ];
    const { db, rows } = createFakeDb({ rows: seedRows });

    const result = await applyThirdPartyTransfer({
      db: db as never,
      transactionId: "tx-200",
      sourceAccountId: "account-tunai",
      sourceContactId: "contact-10",
      destinationAccountId: "account-jago",
      destinationContactId: "contact-10",
      amount: 100000,
      date: "2026-10-21",
      note: "Pindah tempat",
    });

    expect(result.thirdPartyFundIds).toHaveLength(2);
    expect(rows.slice(1)).toEqual([
      { id: expect.any(String), account_id: "account-tunai", contact_id: "contact-10", transaction_id: "tx-200", direction: "out", amount: 100000, date: "2026-10-21", note: "Pindah tempat" },
      { id: expect.any(String), account_id: "account-jago", contact_id: "contact-10", transaction_id: "tx-200", direction: "in", amount: 100000, date: "2026-10-21", note: "Pindah tempat" },
    ]);
  });

  it("pindah kepemilikan (akun sama, kontak beda) membuat baris out+in dengan akun sama", async () => {
    const seedRows: ThirdPartyFundRow[] = [
      { id: "fund-1", account_id: "account-1", contact_id: "contact-adel", transaction_id: "tx-100", direction: "in", amount: 50000, date: "2026-10-17", note: null },
    ];
    const { db, rows } = createFakeDb({ rows: seedRows });

    await applyThirdPartyTransfer({
      db: db as never,
      transactionId: "tx-200",
      sourceAccountId: "account-1",
      sourceContactId: "contact-adel",
      destinationAccountId: "account-1",
      destinationContactId: "contact-mama",
      amount: 50000,
      date: "2026-10-21",
    });

    expect(rows.slice(1)).toEqual([
      { id: expect.any(String), account_id: "account-1", contact_id: "contact-adel", transaction_id: "tx-200", direction: "out", amount: 50000, date: "2026-10-21", note: null },
      { id: expect.any(String), account_id: "account-1", contact_id: "contact-mama", transaction_id: "tx-200", direction: "in", amount: 50000, date: "2026-10-21", note: null },
    ]);
  });

  it("menolak transfer yang melebihi sisa titipan kontak asal", async () => {
    const seedRows: ThirdPartyFundRow[] = [
      { id: "fund-1", account_id: "account-1", contact_id: "contact-10", transaction_id: "tx-100", direction: "in", amount: 50000, date: "2026-10-17", note: null },
    ];
    const { db } = createFakeDb({ rows: seedRows });

    await expect(
      applyThirdPartyTransfer({
        db: db as never,
        transactionId: "tx-200",
        sourceAccountId: "account-1",
        sourceContactId: "contact-10",
        destinationAccountId: "account-2",
        destinationContactId: "contact-10",
        amount: 90000,
        date: "2026-10-21",
      })
    ).rejects.toThrow(InsufficientThirdPartyFundError);
  });
});

describe("detachThirdPartyFundsForDeletedTransaction", () => {
  it("menghapus semua baris yang menempel ke transaksi (termasuk 2 baris transfer)", async () => {
    const seedRows: ThirdPartyFundRow[] = [
      { id: "fund-1", account_id: "account-1", contact_id: "contact-10", transaction_id: "tx-1", direction: "out", amount: 50000, date: "2026-10-17", note: null },
      { id: "fund-2", account_id: "account-2", contact_id: "contact-10", transaction_id: "tx-1", direction: "in", amount: 50000, date: "2026-10-17", note: null },
      { id: "fund-3", account_id: "account-1", contact_id: "contact-20", transaction_id: "tx-2", direction: "in", amount: 1000, date: "2026-10-17", note: null },
    ];
    const { db, rows } = createFakeDb({ rows: seedRows });

    const result = await detachThirdPartyFundsForDeletedTransaction(db as never, "tx-1");

    expect(result.deletedThirdPartyFundIds.sort()).toEqual(["fund-1", "fund-2"]);
    expect(rows).toEqual([{ id: "fund-3", account_id: "account-1", contact_id: "contact-20", transaction_id: "tx-2", direction: "in", amount: 1000, date: "2026-10-17", note: null }]);
  });

  it("tidak melakukan apa pun kalau transaksi tidak punya baris third_party_funds", async () => {
    const { db, rows } = createFakeDb();

    const result = await detachThirdPartyFundsForDeletedTransaction(db as never, "tx-none");

    expect(result).toEqual({ thirdPartyFundIds: [], deletedThirdPartyFundIds: [] });
    expect(rows).toHaveLength(0);
  });
});
