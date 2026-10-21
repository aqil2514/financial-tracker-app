import { newId } from "@/lib/id";
import { getRemainingThirdPartyFund } from "./remaining-third-party-fund-sql";
import type { Db, TouchedThirdPartyFundRows } from "./types";

const none: TouchedThirdPartyFundRows = { thirdPartyFundIds: [], deletedThirdPartyFundIds: [] };

/**
 * Dilempar saat nominal "ambil" (direction: 'out') > sisa titipan kontak
 * tersebut di akun ini (lihat getRemainingThirdPartyFund) — WAJIB ditolak,
 * pola gaya sama InsufficientInvestmentUnitsError
 * (apply-sell-investment-transaction.ts) / UnsupportedAccountPairError
 * (classify-account-pair.ts).
 */
export class InsufficientThirdPartyFundError extends Error {
  constructor(remaining: number, requested: number) {
    super(
      `Nominal yang diambil (${requested}) melebihi sisa titipan kontak ini di akun ini (${remaining}). ` +
        `Periksa kembali nominal, akun, atau kontak yang dipilih.`
    );
    this.name = "InsufficientThirdPartyFundError";
  }
}

async function insertThirdPartyFund(
  db: Db,
  params: {
    accountId: string;
    contactId: string;
    transactionId: string | null;
    direction: "in" | "out";
    amount: number;
    date: string;
    note: string | null;
  }
): Promise<string> {
  const id = newId();
  await db.execute(
    `INSERT INTO third_party_funds (id, account_id, contact_id, transaction_id, direction, amount, date, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, params.accountId, params.contactId, params.transactionId, params.direction, params.amount, params.date, params.note]
  );
  return id;
}

/**
 * Titip masuk / ambil keluar pada SATU akun `third_party` — pola
 * `income`/`expense` SATU SISI (seperti investasi `record_mode: direct`),
 * BUKAN trigger dari `transfer` seperti `applyDebtTransaction` (lihat
 * docs/concept/konsep-dana-pihak-ketiga.md, "Titip masuk / Ambil keluar").
 * Kontak WAJIB diisi (schema `third_party_funds.contact_id` NOT NULL) —
 * caller (form) yang menjamin ini, bukan fungsi ini (konsisten dgn
 * `createDebt` yang juga tidak memvalidasi `contactId` nullable di
 * level sini kecuali kolomnya memang mengizinkan null).
 *
 * `income` = nitip (direction 'in'), `expense` = ambil (direction 'out',
 * divalidasi oversell lebih dulu — lihat InsufficientThirdPartyFundError).
 */
export type ApplyDirectThirdPartyTransactionInput = {
  db: Db;
  transactionId: string;
  type: "income" | "expense";
  accountId: string;
  contactId: string;
  amount: number;
  date: string;
  note?: string | null;
};

export async function applyDirectThirdPartyTransaction({
  db,
  transactionId,
  type,
  accountId,
  contactId,
  amount,
  date,
  note = null,
}: ApplyDirectThirdPartyTransactionInput): Promise<TouchedThirdPartyFundRows> {
  const direction = type === "income" ? "in" : "out";

  if (direction === "out") {
    const remaining = await getRemainingThirdPartyFund(db, accountId, contactId);
    if (amount > remaining) {
      throw new InsufficientThirdPartyFundError(remaining, amount);
    }
  }

  const id = await insertThirdPartyFund(db, { accountId, contactId, transactionId, direction, amount, date, note });
  return { thirdPartyFundIds: [id], deletedThirdPartyFundIds: [] };
}

/**
 * Pindah tempat dan/atau pindah kepemilikan — `transfer` ANTAR akun
 * `third_party` (satu-satunya kombinasi valid, lihat classifyAccountPair
 * `third_party-third_party`). Menghasilkan DUA baris independen per
 * transaksi: satu `out` di (akun sumber, kontak asal), satu `in` di (akun
 * tujuan, kontak tujuan) — TIDAK bisa hanya mengandalkan `transactions.type`
 * karena kontak sisi keluar/masuk independen (lihat dokumen konsep,
 * "Pindah tempat dan/atau pindah kepemilikan": boleh akun sama+kontak beda,
 * akun beda+kontak sama, atau kombinasi keduanya).
 *
 * BEDA dari `debt-debt` yang no-op (classify-account-pair.ts) — ini
 * kombinasi PERTAMA di app ini yang benar-benar mengimplementasikan efek
 * transfer antar-akun-sama-tipe. Validasi oversell dicek untuk sisi
 * keluar (sourceContactId di sourceAccountId), sama seperti direction
 * 'out' di applyDirectThirdPartyTransaction.
 */
export type ApplyThirdPartyTransferInput = {
  db: Db;
  transactionId: string;
  sourceAccountId: string;
  sourceContactId: string;
  destinationAccountId: string;
  destinationContactId: string;
  amount: number;
  date: string;
  note?: string | null;
};

export async function applyThirdPartyTransfer({
  db,
  transactionId,
  sourceAccountId,
  sourceContactId,
  destinationAccountId,
  destinationContactId,
  amount,
  date,
  note = null,
}: ApplyThirdPartyTransferInput): Promise<TouchedThirdPartyFundRows> {
  const remaining = await getRemainingThirdPartyFund(db, sourceAccountId, sourceContactId);
  if (amount > remaining) {
    throw new InsufficientThirdPartyFundError(remaining, amount);
  }

  const outId = await insertThirdPartyFund(db, {
    accountId: sourceAccountId,
    contactId: sourceContactId,
    transactionId,
    direction: "out",
    amount,
    date,
    note,
  });
  const inId = await insertThirdPartyFund(db, {
    accountId: destinationAccountId,
    contactId: destinationContactId,
    transactionId,
    direction: "in",
    amount,
    date,
    note,
  });

  return { thirdPartyFundIds: [outId, inId], deletedThirdPartyFundIds: [] };
}

/** Dipanggil SEBELUM hard-delete baris `transactions` — hapus semua baris
 * `third_party_funds` yang menempel ke transaksi ini (1 baris untuk
 * income/expense langsung, 2 baris untuk transfer third_party->third_party,
 * lihat applyThirdPartyTransfer). Hard-delete murni (TIDAK ada status
 * "lunas" yang perlu disesuaikan ulang, beda dari
 * detachDebtForDeletedTransaction yang perlu `UPDATE debts SET status`) —
 * konsisten dengan sisa titipan yang selalu dihitung ulang dari SUM.
 */
export async function detachThirdPartyFundsForDeletedTransaction(
  db: Db,
  transactionId: string
): Promise<TouchedThirdPartyFundRows> {
  const rows = await db.select<{ id: string }[]>(
    "SELECT id FROM third_party_funds WHERE transaction_id = $1",
    [transactionId]
  );
  if (rows.length === 0) return none;

  await db.execute("DELETE FROM third_party_funds WHERE transaction_id = $1", [transactionId]);
  return { thirdPartyFundIds: [], deletedThirdPartyFundIds: rows.map((r) => r.id) };
}
