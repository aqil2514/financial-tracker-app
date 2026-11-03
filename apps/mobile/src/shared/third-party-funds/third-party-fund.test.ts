import { beforeEach, describe, expect, it } from "vitest";
import type { SQLiteDatabase } from "expo-sqlite";
import { createSqliteTestDb } from "@/lib/database/testing/sqlite-test-db";
import {
  deleteThirdPartyFundEntry,
  detachThirdPartyFundsForDeletedTransaction,
  getRemainingThirdPartyFund,
  getTransactionThirdPartyFund,
  InsufficientThirdPartyFundError,
  recordThirdPartyFund,
  recordThirdPartyTransfer,
  ThirdPartyFundEditBlockedError,
  updateThirdPartyFund,
} from ".";

let db: SQLiteDatabase;

const DATE = "2026-11-03T10:00:00.000Z";

async function count(table: string) {
  return (await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))?.n;
}

async function accountBalance(accountId: string) {
  const row = await db.getFirstAsync<{ balance: number }>(
    `SELECT initial_balance
       + COALESCE((SELECT SUM(CASE WHEN type='income' THEN amount WHEN type IN ('expense','transfer') THEN -amount ELSE 0 END)
                   FROM transactions WHERE account_id = ?1), 0)
       + COALESCE((SELECT SUM(amount) FROM transactions WHERE type='transfer' AND transfer_account_id = ?1), 0) AS balance
     FROM accounts WHERE id = ?1`,
    [accountId]
  );
  return row?.balance;
}

const BASE = { accountId: "tunai", contactId: "adel", date: DATE, note: null };

async function titip(amount: number, overrides: Partial<typeof BASE> & { contactId?: string } = {}) {
  return recordThirdPartyFund({ db, ...BASE, ...overrides, direction: "in", amount });
}

beforeEach(async () => {
  db = await createSqliteTestDb();
  await db.execAsync(`
    INSERT INTO accounts (id, name, account_type, initial_balance) VALUES
      ('kas', 'Kas', 'cash', 1000000),
      ('tunai', 'Kas Orang Lain [Tunai]', 'third_party', 0),
      ('jago', 'Kas Orang Lain [Jago]', 'third_party', 0);
    INSERT INTO contacts (id, name) VALUES ('adel', 'Adel'), ('mama', 'Mama');
  `);
});

describe("recordThirdPartyFund", () => {
  it("titip = income di akun third_party, kas pribadi tidak tersentuh", async () => {
    await titip(50_000);

    expect(await accountBalance("tunai")).toBe(50_000);
    expect(await accountBalance("kas")).toBe(1_000_000);
    expect(await getRemainingThirdPartyFund(db, "tunai", "adel")).toBe(50_000);
    const tx = await db.getFirstAsync<{ type: string }>("SELECT type FROM transactions");
    expect(tx?.type).toBe("income");
  });

  it("ambil = expense, menurunkan sisa titipan kontak itu saja", async () => {
    await titip(50_000);
    await titip(20_000, { contactId: "mama" });

    await recordThirdPartyFund({ db, ...BASE, direction: "out", amount: 30_000 });

    expect(await getRemainingThirdPartyFund(db, "tunai", "adel")).toBe(20_000);
    expect(await getRemainingThirdPartyFund(db, "tunai", "mama")).toBe(20_000);
    expect(await accountBalance("tunai")).toBe(40_000);
  });

  it("note ikut tersimpan di third_party_funds, bukan hanya di transactions", async () => {
    await recordThirdPartyFund({ db, ...BASE, direction: "in", amount: 10_000, note: "Tabungan" });

    const fund = await db.getFirstAsync<{ note: string }>("SELECT note FROM third_party_funds");
    expect(fund?.note).toBe("Tabungan");
  });

  it("ambil melebihi sisa ditolak dan tidak meninggalkan transaksi hantu", async () => {
    await titip(10_000);
    const txBefore = await count("transactions");

    await expect(recordThirdPartyFund({ db, ...BASE, direction: "out", amount: 10_001 })).rejects.toBeInstanceOf(
      InsufficientThirdPartyFundError
    );

    expect(await count("transactions")).toBe(txBefore);
    expect(await count("third_party_funds")).toBe(1);
  });

  it("ambil dari kontak yang belum pernah menitip ditolak (sisa 0)", async () => {
    await titip(10_000);
    await expect(
      recordThirdPartyFund({ db, ...BASE, contactId: "mama", direction: "out", amount: 1 })
    ).rejects.toBeInstanceOf(InsufficientThirdPartyFundError);
  });
});

describe("recordThirdPartyTransfer", () => {
  it("pindah tempat: satu transaksi transfer, dua baris, kontak sama", async () => {
    await titip(50_000);

    await recordThirdPartyTransfer({
      db,
      sourceAccountId: "tunai",
      sourceContactId: "adel",
      destinationAccountId: "jago",
      destinationContactId: "adel",
      amount: 20_000,
      date: DATE,
      note: null,
    });

    expect(await getRemainingThirdPartyFund(db, "tunai", "adel")).toBe(30_000);
    expect(await getRemainingThirdPartyFund(db, "jago", "adel")).toBe(20_000);
    expect(await accountBalance("tunai")).toBe(30_000);
    expect(await accountBalance("jago")).toBe(20_000);
    // Titip awal 1 baris + transfer 2 baris (satu transaksi bersama).
    expect(await count("third_party_funds")).toBe(3);
    expect(await count("transactions")).toBe(2);
    const rows = await db.getAllAsync<{ transaction_id: string }>(
      "SELECT transaction_id FROM third_party_funds WHERE direction = 'out' OR account_id = 'jago'"
    );
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.transaction_id)).size).toBe(1);
  });

  it("pindah kepemilikan di akun yang sama: saldo akun tetap, sisa kontak bergeser", async () => {
    await titip(50_000);

    await recordThirdPartyTransfer({
      db,
      sourceAccountId: "tunai",
      sourceContactId: "adel",
      destinationAccountId: "tunai",
      destinationContactId: "mama",
      amount: 15_000,
      date: DATE,
      note: null,
    });

    expect(await getRemainingThirdPartyFund(db, "tunai", "adel")).toBe(35_000);
    expect(await getRemainingThirdPartyFund(db, "tunai", "mama")).toBe(15_000);
    expect(await accountBalance("tunai")).toBe(50_000);
  });

  it("ditolak kalau akun dan kontak asal sama dengan tujuan", async () => {
    await titip(50_000);
    await expect(
      recordThirdPartyTransfer({
        db,
        sourceAccountId: "tunai",
        sourceContactId: "adel",
        destinationAccountId: "tunai",
        destinationContactId: "adel",
        amount: 1,
        date: DATE,
        note: null,
      })
    ).rejects.toThrow();
  });

  it("oversell di sisi sumber ditolak dan tidak menulis apa pun", async () => {
    await titip(10_000);
    const txBefore = await count("transactions");

    await expect(
      recordThirdPartyTransfer({
        db,
        sourceAccountId: "tunai",
        sourceContactId: "adel",
        destinationAccountId: "jago",
        destinationContactId: "adel",
        amount: 10_001,
        date: DATE,
        note: null,
      })
    ).rejects.toBeInstanceOf(InsufficientThirdPartyFundError);

    expect(await count("transactions")).toBe(txBefore);
    expect(await count("third_party_funds")).toBe(1);
  });
});

describe("updateThirdPartyFund", () => {
  async function fundIdOf(transactionId: string) {
    const row = await db.getFirstAsync<{ id: string }>("SELECT id FROM third_party_funds WHERE transaction_id = ?", [
      transactionId,
    ]);
    return row?.id as string;
  }

  it("mengubah nominal, tanggal, dan catatan di fund DAN transaksinya", async () => {
    const txId = await titip(10_000);

    await updateThirdPartyFund({
      db,
      fundId: await fundIdOf(txId),
      amount: 12_000,
      date: "2026-11-04T10:00:00.000Z",
      note: "Koreksi",
    });

    expect(await accountBalance("tunai")).toBe(12_000);
    const fund = await db.getFirstAsync<{ amount: number; date: string; note: string }>(
      "SELECT amount, date, note FROM third_party_funds"
    );
    expect(fund).toEqual({ amount: 12_000, date: "2026-11-04T10:00:00.000Z", note: "Koreksi" });
  });

  it("edit ambil melebihi sisa ditolak; baris itu sendiri tidak dihitung dua kali", async () => {
    await titip(10_000);
    const outTx = await recordThirdPartyFund({ db, ...BASE, direction: "out", amount: 4_000 });
    const outFund = await fundIdOf(outTx);

    // Sisa tanpa baris ambil ini = 10.000, jadi 10.000 boleh, 10.001 tidak.
    await updateThirdPartyFund({ db, fundId: outFund, amount: 10_000, date: DATE, note: null });
    await expect(
      updateThirdPartyFund({ db, fundId: outFund, amount: 10_001, date: DATE, note: null })
    ).rejects.toBeInstanceOf(InsufficientThirdPartyFundError);
  });

  it("mengurangi titipan sampai di bawah yang sudah diambil diblok", async () => {
    const inTx = await titip(10_000);
    await recordThirdPartyFund({ db, ...BASE, direction: "out", amount: 6_000 });

    await expect(
      updateThirdPartyFund({ db, fundId: await fundIdOf(inTx), amount: 5_000, date: DATE, note: null })
    ).rejects.toBeInstanceOf(ThirdPartyFundEditBlockedError);
    await updateThirdPartyFund({ db, fundId: await fundIdOf(inTx), amount: 6_000, date: DATE, note: null });
  });

  it("baris transfer tidak bisa diedit", async () => {
    await titip(10_000);
    const transferTx = await recordThirdPartyTransfer({
      db,
      sourceAccountId: "tunai",
      sourceContactId: "adel",
      destinationAccountId: "jago",
      destinationContactId: "adel",
      amount: 5_000,
      date: DATE,
      note: null,
    });
    const rows = await db.getAllAsync<{ id: string }>("SELECT id FROM third_party_funds WHERE transaction_id = ?", [
      transferTx,
    ]);

    for (const row of rows) {
      await expect(
        updateThirdPartyFund({ db, fundId: row.id, amount: 1, date: DATE, note: null })
      ).rejects.toBeInstanceOf(ThirdPartyFundEditBlockedError);
    }
  });
});

describe("hapus", () => {
  it("detach menghapus baris riwayat transaksinya, bukan membiarkan yatim", async () => {
    const txId = await titip(10_000);

    const info = await detachThirdPartyFundsForDeletedTransaction(db, txId);

    expect(info.role).toBe("fund");
    expect(await count("third_party_funds")).toBe(0);
  });

  it("detach transaksi biasa mengembalikan none", async () => {
    await db.execAsync(
      `INSERT INTO transactions (id, note, type, amount, date, account_id) VALUES ('biasa', '', 'expense', 1, '${DATE}', 'kas')`
    );
    expect((await detachThirdPartyFundsForDeletedTransaction(db, "biasa")).role).toBe("none");
    expect((await getTransactionThirdPartyFund(db, "biasa")).role).toBe("none");
  });

  it("menghapus titipan yang sebagian sudah diambil diblok, dan tidak menghapus apa pun", async () => {
    const inTx = await titip(10_000);
    await recordThirdPartyFund({ db, ...BASE, direction: "out", amount: 6_000 });

    await expect(detachThirdPartyFundsForDeletedTransaction(db, inTx)).rejects.toBeInstanceOf(
      ThirdPartyFundEditBlockedError
    );
    expect(await count("third_party_funds")).toBe(2);
  });

  it("menghapus pengambilan selalu boleh, sisa titipan pulih", async () => {
    await titip(10_000);
    const outTx = await recordThirdPartyFund({ db, ...BASE, direction: "out", amount: 6_000 });

    await detachThirdPartyFundsForDeletedTransaction(db, outTx);

    expect(await getRemainingThirdPartyFund(db, "tunai", "adel")).toBe(10_000);
  });

  it("deleteThirdPartyFundEntry pada baris transfer menghapus pasangan DAN transaksinya", async () => {
    await titip(10_000);
    const transferTx = await recordThirdPartyTransfer({
      db,
      sourceAccountId: "tunai",
      sourceContactId: "adel",
      destinationAccountId: "jago",
      destinationContactId: "mama",
      amount: 4_000,
      date: DATE,
      note: null,
    });
    const inRow = await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM third_party_funds WHERE transaction_id = ? AND direction = 'in'",
      [transferTx]
    );

    await deleteThirdPartyFundEntry(db, inRow?.id as string);

    expect(await count("third_party_funds")).toBe(1);
    expect(await count("transactions")).toBe(1);
    expect(await getRemainingThirdPartyFund(db, "tunai", "adel")).toBe(10_000);
  });

  it("deleteThirdPartyFundEntry pada transfer diblok kalau tujuan sudah dipakai ambil", async () => {
    await titip(10_000);
    const transferTx = await recordThirdPartyTransfer({
      db,
      sourceAccountId: "tunai",
      sourceContactId: "adel",
      destinationAccountId: "jago",
      destinationContactId: "adel",
      amount: 4_000,
      date: DATE,
      note: null,
    });
    await recordThirdPartyFund({ db, ...BASE, accountId: "jago", direction: "out", amount: 1_000 });
    const outRow = await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM third_party_funds WHERE transaction_id = ? AND direction = 'out'",
      [transferTx]
    );

    await expect(deleteThirdPartyFundEntry(db, outRow?.id as string)).rejects.toBeInstanceOf(
      ThirdPartyFundEditBlockedError
    );
    expect(await count("third_party_funds")).toBe(4);
    expect(await count("transactions")).toBe(3);
  });
});
