import { applyDebtTransaction } from "@/shared/debts/apply-debt-transaction";
import type { Db } from "../types";
import type { ArApRow } from "./extract-ar-ap-rows";

const RECEIVABLE_CONTACT_NAME = "Piutang Retailku";
const PAYABLE_CONTACT_NAME = "Utang Retailku";

/** Sama seperti kontak generik lama (`sync-ar-ap.ts`, DIHAPUS) — kedua
 * arah SELALU digabung ke SATU kontak generik per arah, bukan per
 * pihak Retailku individual, lihat keputusan awal di
 * retailku-cashflow-sync.md. Dipertahankan APA ADANYA supaya kontak
 * lama ("Piutang Retailku"/"Utang Retailku", id 5/6 di database dev
 * yang sudah ada) TETAP dipakai, bukan duplikat kontak baru. */
async function resolveGenericContactId(db: Db, name: string): Promise<number> {
  const existing = await db.select<{ id: number }[]>(
    "SELECT id FROM contacts WHERE name = $1 COLLATE NOCASE LIMIT 1",
    [name]
  );
  if (existing.length > 0) return existing[0].id;

  const result = await db.execute("INSERT INTO contacts (name) VALUES ($1)", [name]);
  if (result.lastInsertId == null) {
    throw new Error(`Gagal membuat kontak "${name}"`);
  }
  return result.lastInsertId;
}

async function loadOngoingDebtIds(
  db: Db,
  contactId: number,
  type: "receivable" | "payable"
): Promise<string[]> {
  const rows = await db.select<{ id: number }[]>(
    `SELECT id FROM debts WHERE contact_id = $1 AND type = $2 AND status = 'ongoing' ORDER BY date ASC, id ASC`,
    [contactId, type]
  );
  return rows.map((row) => String(row.id));
}

async function insertTransferTransaction(
  db: Db,
  params: {
    accountId: number;
    transferAccountId: number;
    amount: number;
    date: string;
    contactId: number;
    note: string;
    sourceRef: string;
  }
): Promise<number> {
  const result = await db.execute(
    `INSERT INTO transactions (type, amount, account_id, transfer_account_id, note, date, contact_id, source, source_ref)
     VALUES ('transfer', $1, $2, $3, $4, $5, $6, 'retailku_sync', $7)`,
    // Lihat catatan sama di insert-cashflow-transaction.ts soal
    // "T00:00" wajib untuk kolom transactions.date.
    [
      params.amount,
      params.accountId,
      params.transferAccountId,
      params.note,
      `${params.date}T00:00`,
      params.contactId,
      params.sourceRef,
    ]
  );
  const transactionId = result.lastInsertId;
  if (transactionId == null) {
    throw new Error("Gagal menyimpan transaksi sinkronisasi AR/AP");
  }
  return transactionId;
}

/**
 * Insert SATU baris piutang/utang (dari `extractArApRows`) — pengganti
 * `insertDebtTransaction` di `sync-ar-ap.ts` (DIHAPUS beserta seluruh
 * mekanisme snapshot-diff-nya, lihat
 * docs/todos/plan/retailku-ar-ap-via-cashflow-detail.md). Beda dari versi
 * lama: DUA cabang alih-alih satu, karena baris di sini bisa berarti
 * "piutang/utang BARU" (`row.amount > 0`) ATAU "pelunasan"
 * (`row.amount < 0`) — versi lama TIDAK PERNAH menangani pelunasan sama
 * sekali (dianggap "delta negatif, diabaikan").
 *
 * **Arah transfer PENTING dan MUDAH SALAH** (dikoreksi lewat pembacaan
 * ulang `use-pay-debt.ts`, BUKAN diasumsikan): pelunasan PIUTANG maupun
 * UTANG **SAMA-SAMA** arah `debt->cash`, `debtAction: "settlement"` —
 * BUKAN `cash->debt` untuk pelunasan utang seperti tebakan pertama.
 * `applyDebtTransaction` SUDAH LENGKAP menangani ini TANPA perlu cabang
 * baru — `settleDebtsFifo` men-cek `debts.id IN (settleDebtIds)` yang
 * SUDAH difilter `type` oleh `loadOngoingDebtIds` di bawah, jadi otomatis
 * benar melunasi jenis debt yang tepat.
 *
 * Ringkasan 4 kombinasi (SEMUA sudah didukung `applyDebtTransaction`
 * tanpa modifikasi):
 * - Piutang baru: cash->debt, `debtAction: null`.
 * - Utang baru: debt->cash, `debtAction: "payable"`.
 * - Pelunasan piutang: debt->cash, `debtAction: "settlement"`,
 *   `settleDebtIds` dari `debts` `type='receivable'`.
 * - Pelunasan utang: debt->cash, `debtAction: "settlement"`,
 *   `settleDebtIds` dari `debts` `type='payable'`.
 *
 * Pelunasan pakai strategi FIFO OTOMATIS (keputusan eksplisit, BUKAN
 * user pilih debt yang dilunasi seperti form manual) — ambil SEMUA
 * `debts` kontak generik terkait yang masih `ongoing`, urut dari
 * TERTUA, lempar semuanya sebagai `settleDebtIds` (fungsi itu SENDIRI
 * yang mengalokasikan FIFO berhenti begitu `amount` habis). Risiko yang
 * DISADARI: urutan pelunasan FIFO lokal bisa beda dari urutan pelunasan
 * riil di Retailku (per PIHAK individual, digabung generik di sini),
 * TAPI total outstanding tetap akurat — trade-off yang SAMA diterima
 * sejak desain kontak generik ini (bukan baru muncul di sini).
 */
export async function insertArApTransaction(
  db: Db,
  row: ArApRow,
  cashAccountId: number,
  debtAccountId: number
): Promise<void> {
  const isReceivable = row.direction === "receivable";
  const contactId = await resolveGenericContactId(
    db,
    isReceivable ? RECEIVABLE_CONTACT_NAME : PAYABLE_CONTACT_NAME
  );

  const isNew = row.amount > 0;
  const amount = Math.abs(row.amount);

  if (isNew && isReceivable) {
    // Piutang baru: cash -> debt.
    const transactionId = await insertTransferTransaction(db, {
      accountId: cashAccountId,
      transferAccountId: debtAccountId,
      amount,
      date: row.date,
      contactId,
      note: "Piutang Retailku (sinkronisasi)",
      sourceRef: row.sourceRef,
    });
    await applyDebtTransaction({
      db,
      transactionId,
      type: "transfer",
      accountId: cashAccountId,
      transferAccountId: debtAccountId,
      contactId,
      amount,
      date: row.date,
      debtAction: null,
      settleDebtIds: [],
    });
    return;
  }

  if (isNew && !isReceivable) {
    // Utang baru: debt -> cash, debtAction 'payable'.
    const transactionId = await insertTransferTransaction(db, {
      accountId: debtAccountId,
      transferAccountId: cashAccountId,
      amount,
      date: row.date,
      contactId,
      note: "Utang Retailku (sinkronisasi)",
      sourceRef: row.sourceRef,
    });
    await applyDebtTransaction({
      db,
      transactionId,
      type: "transfer",
      accountId: debtAccountId,
      transferAccountId: cashAccountId,
      contactId,
      amount,
      date: row.date,
      debtAction: "payable",
      settleDebtIds: [],
    });
    return;
  }

  // Pelunasan (piutang ATAU utang) — SAMA-SAMA debt -> cash.
  const settleDebtIds = await loadOngoingDebtIds(
    db,
    contactId,
    isReceivable ? "receivable" : "payable"
  );
  const transactionId = await insertTransferTransaction(db, {
    accountId: debtAccountId,
    transferAccountId: cashAccountId,
    amount,
    date: row.date,
    contactId,
    note: isReceivable
      ? "Pelunasan Piutang Retailku (sinkronisasi)"
      : "Pelunasan Utang Retailku (sinkronisasi)",
    sourceRef: row.sourceRef,
  });
  await applyDebtTransaction({
    db,
    transactionId,
    type: "transfer",
    accountId: debtAccountId,
    transferAccountId: cashAccountId,
    contactId,
    amount,
    date: row.date,
    debtAction: "settlement",
    settleDebtIds,
  });
}
