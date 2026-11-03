import type { SQLiteDatabase } from "expo-sqlite";
import { generateId } from "@/lib/database/generate-id";
import { getRemainingThirdPartyFund } from "./third-party-fund-math";

// Ambil/pindah lebih dari sisa titipan kontak itu di akun itu tidak mungkin valid, jadi WAJIB ditolak.
export class InsufficientThirdPartyFundError extends Error {
  constructor(remaining: number, requested: number) {
    super(
      `Nominal yang diambil (${requested}) melebihi sisa titipan kontak ini di akun ini (${remaining}). ` +
        `Periksa kembali nominal, akun, atau kontak yang dipilih.`
    );
    this.name = "InsufficientThirdPartyFundError";
  }
}

// Edit/hapus yang membuat sisa titipan sebuah (akun, kontak) jadi negatif (mis. menghapus titipan yang sudah
// sebagian diambil). Beda dari desktop yang tidak memblok.
export class ThirdPartyFundEditBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ThirdPartyFundEditBlockedError";
  }
}

async function insertFund(
  db: SQLiteDatabase,
  params: {
    accountId: string;
    contactId: string;
    transactionId: string;
    direction: "in" | "out";
    amount: number;
    date: string;
    note: string | null;
  }
) {
  await db.runAsync(
    `INSERT INTO third_party_funds (id, account_id, contact_id, transaction_id, direction, amount, date, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      params.accountId,
      params.contactId,
      params.transactionId,
      params.direction,
      params.amount,
      params.date,
      params.note,
    ]
  );
}

export type RecordThirdPartyFundInput = {
  db: SQLiteDatabase;
  accountId: string;
  contactId: string;
  direction: "in" | "out";
  amount: number;
  date: string;
  note: string | null;
};

// Titip = income, ambil = expense, keduanya SATU SISI pada akun third_party (tidak menyentuh akun kas).
// Satu transaksi SQLite: validasi oversell dulu, baru menulis transaksi + baris riwayat.
export async function recordThirdPartyFund(input: RecordThirdPartyFundInput): Promise<string> {
  const { db, accountId, contactId, direction, amount, date, note } = input;
  const transactionId = generateId();

  await db.withTransactionAsync(async () => {
    if (direction === "out") {
      const remaining = await getRemainingThirdPartyFund(db, accountId, contactId);
      if (amount > remaining) throw new InsufficientThirdPartyFundError(remaining, amount);
    }

    await db.runAsync(
      `INSERT INTO transactions (id, note, description, type, amount, date, category_id, account_id, transfer_account_id)
       VALUES (?, ?, NULL, ?, ?, ?, NULL, ?, NULL)`,
      [transactionId, note ?? "", direction === "in" ? "income" : "expense", amount, date, accountId]
    );
    await insertFund(db, { accountId, contactId, transactionId, direction, amount, date, note });
  });

  return transactionId;
}

export type RecordThirdPartyTransferInput = {
  db: SQLiteDatabase;
  sourceAccountId: string;
  sourceContactId: string;
  destinationAccountId: string;
  destinationContactId: string;
  amount: number;
  date: string;
  note: string | null;
};

// Pindah tempat dan/atau kepemilikan: SATU transaksi transfer, DUA baris riwayat (out di sumber, in di tujuan)
// dengan kontak sisi keluar/masuk independen. Akun dan kontak boleh sama di satu sisi, tapi tidak keduanya.
export async function recordThirdPartyTransfer(input: RecordThirdPartyTransferInput): Promise<string> {
  const { db, sourceAccountId, sourceContactId, destinationAccountId, destinationContactId, amount, date, note } =
    input;
  if (sourceAccountId === destinationAccountId && sourceContactId === destinationContactId) {
    throw new Error("Akun dan kontak asal sama dengan tujuan — tidak ada yang dipindahkan.");
  }

  const transactionId = generateId();
  await db.withTransactionAsync(async () => {
    const remaining = await getRemainingThirdPartyFund(db, sourceAccountId, sourceContactId);
    if (amount > remaining) throw new InsufficientThirdPartyFundError(remaining, amount);

    await db.runAsync(
      `INSERT INTO transactions (id, note, description, type, amount, date, category_id, account_id, transfer_account_id)
       VALUES (?, ?, NULL, 'transfer', ?, ?, NULL, ?, ?)`,
      [transactionId, note ?? "", amount, date, sourceAccountId, destinationAccountId]
    );
    await insertFund(db, {
      accountId: sourceAccountId,
      contactId: sourceContactId,
      transactionId,
      direction: "out",
      amount,
      date,
      note,
    });
    await insertFund(db, {
      accountId: destinationAccountId,
      contactId: destinationContactId,
      transactionId,
      direction: "in",
      amount,
      date,
      note,
    });
  });

  return transactionId;
}

export type UpdateThirdPartyFundInput = {
  db: SQLiteDatabase;
  fundId: string;
  amount: number;
  date: string;
  note: string | null;
};

// Hanya baris direct (titip/ambil); akun, kontak, dan arah terkunci. Baris transfer (dua baris berpasangan)
// tidak bisa diedit — hapus lalu catat ulang.
export async function updateThirdPartyFund(input: UpdateThirdPartyFundInput) {
  const { db, fundId, amount, date, note } = input;

  await db.withTransactionAsync(async () => {
    const fund = await db.getFirstAsync<{
      account_id: string;
      contact_id: string;
      transaction_id: string | null;
      direction: "in" | "out";
      transaction_type: "income" | "expense" | "transfer" | null;
    }>(
      `SELECT f.account_id, f.contact_id, f.transaction_id, f.direction, t.type AS transaction_type
       FROM third_party_funds f LEFT JOIN transactions t ON t.id = f.transaction_id
       WHERE f.id = ?`,
      [fundId]
    );
    if (!fund) throw new Error("Baris riwayat dana pihak ketiga tidak ditemukan.");
    if (fund.transaction_id == null || fund.transaction_type === "transfer") {
      throw new ThirdPartyFundEditBlockedError(
        "Riwayat pindah tempat/kepemilikan tidak bisa diedit. Hapus lalu catat ulang."
      );
    }

    const others = await getRemainingThirdPartyFund(db, fund.account_id, fund.contact_id, fundId);
    const after = fund.direction === "in" ? others + amount : others - amount;
    if (after < 0) {
      throw fund.direction === "out"
        ? new InsufficientThirdPartyFundError(others, amount)
        : new ThirdPartyFundEditBlockedError(
            `Nominal titipan tidak bisa dikurangi sampai ${amount}: sebagian sudah diambil atau dipindahkan (sisa tanpa baris ini ${others}).`
          );
    }

    await db.runAsync("UPDATE third_party_funds SET amount = ?, date = ?, note = ? WHERE id = ?", [
      amount,
      date,
      note,
      fundId,
    ]);
    // transactions.note NOT NULL (catatan kosong = string kosong), fund.note boleh NULL.
    await db.runAsync("UPDATE transactions SET amount = ?, date = ?, note = ? WHERE id = ?", [
      amount,
      date,
      note ?? "",
      fund.transaction_id,
    ]);
  });
}

export type TransactionThirdPartyFundInfo = { role: "none" } | { role: "fund"; fundIds: string[] };

// Transaksi ini punya baris third_party_funds (titip/ambil/transfer) — bukan transaksi biasa.
export async function getTransactionThirdPartyFund(
  db: SQLiteDatabase,
  transactionId: string
): Promise<TransactionThirdPartyFundInfo> {
  const rows = await db.getAllAsync<{ id: string }>("SELECT id FROM third_party_funds WHERE transaction_id = ?", [
    transactionId,
  ]);
  return rows.length === 0 ? { role: "none" } : { role: "fund", fundIds: rows.map((r) => r.id) };
}

// Dipanggil SEBELUM baris transactions di-hard-delete (FK SET NULL saja meninggalkan baris yatim yang masih
// ikut menghitung sisa titipan). Memblok kalau penghapusan membuat sisa sebuah (akun, kontak) negatif.
export async function detachThirdPartyFundsForDeletedTransaction(
  db: SQLiteDatabase,
  transactionId: string
): Promise<TransactionThirdPartyFundInfo> {
  const rows = await db.getAllAsync<{
    id: string;
    account_id: string;
    contact_id: string;
    direction: "in" | "out";
    amount: number;
  }>("SELECT id, account_id, contact_id, direction, amount FROM third_party_funds WHERE transaction_id = ?", [
    transactionId,
  ]);
  if (rows.length === 0) return { role: "none" };

  // Efek penghapusan per pasangan: sisa berkurang sebesar (in - out) milik transaksi ini.
  const removed = new Map<string, { accountId: string; contactId: string; delta: number }>();
  for (const row of rows) {
    const key = `${row.account_id}|${row.contact_id}`;
    const entry = removed.get(key) ?? { accountId: row.account_id, contactId: row.contact_id, delta: 0 };
    entry.delta += row.direction === "in" ? row.amount : -row.amount;
    removed.set(key, entry);
  }
  for (const { accountId, contactId, delta } of removed.values()) {
    if (delta <= 0) continue;
    const remaining = await getRemainingThirdPartyFund(db, accountId, contactId);
    if (remaining - delta < 0) {
      throw new ThirdPartyFundEditBlockedError(
        "Titipan ini sebagian sudah diambil atau dipindahkan. Hapus dulu riwayat pengambilan/pemindahan yang terkait, baru hapus titipan ini."
      );
    }
  }

  await db.runAsync("DELETE FROM third_party_funds WHERE transaction_id = ?", [transactionId]);
  return { role: "fund", fundIds: rows.map((r) => r.id) };
}

// Hapus satu entri riwayat dari layar Dana Pihak Ketiga: baris riwayat (+ pasangannya kalau transfer) dan
// transaksinya, atomik.
export async function deleteThirdPartyFundEntry(db: SQLiteDatabase, fundId: string) {
  await db.withTransactionAsync(async () => {
    const fund = await db.getFirstAsync<{ transaction_id: string | null }>(
      "SELECT transaction_id FROM third_party_funds WHERE id = ?",
      [fundId]
    );
    if (!fund) throw new Error("Baris riwayat dana pihak ketiga tidak ditemukan.");
    if (fund.transaction_id == null) {
      await db.runAsync("DELETE FROM third_party_funds WHERE id = ?", [fundId]);
      return;
    }
    await detachThirdPartyFundsForDeletedTransaction(db, fund.transaction_id);
    await db.runAsync("DELETE FROM transactions WHERE id = ?", [fund.transaction_id]);
  });
}
