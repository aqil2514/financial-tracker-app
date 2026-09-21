import { getDb } from "@/lib/db";
import { applyDebtTransaction } from "@/shared/debts/apply-debt-transaction";
import type { RetailkuMcpConfig } from "./mcp-connection";
import { connectRetailkuMcp } from "./mcp-connection";
import { getArAp, type RetailkuArApParty } from "./mcp-tools";

type Db = Awaited<ReturnType<typeof getDb>>;

const RECEIVABLE_CONTACT_NAME = "Piutang Retailku";
const PAYABLE_CONTACT_NAME = "Utang Retailku";

export type SyncArApInput = {
  mcpConfig: RetailkuMcpConfig;
  /** Akun kas lokal (sama dengan tujuan sync cashflow) — sisi kas dari
   * transfer piutang/utang. */
  localCashAccountId: number;
  /** Akun bertipe `debt` lokal, DUA field terpisah (piutang & utang),
   * dipilih manual oleh user di tab Konfigurasi — lihat "Sync AR/AP —
   * akun debt lokal" di retailku-cashflow-sync.md. */
  receivableDebtAccountId: number;
  payableDebtAccountId: number;
  /** Tanggal ISO hari ini — dipakai sebagai `date` transaksi & bagian
   * dari `source_ref`, lihat "Sync AR/AP — idempotency" di
   * retailku-cashflow-sync.md. */
  today: string;
};

export type SyncArApResult = {
  insertedCount: number;
  /** `source_ref` dari SEMUA baris yang berhasil di-insert sync ini —
   * dipakai `sync-all.ts` untuk ROLLBACK MANUAL kalau jalur lain gagal,
   * lihat catatan di `sync-cashflow.ts` soal keterbatasan
   * @tauri-apps/plugin-sql (tidak mendukung BEGIN/COMMIT lintas-panggilan
   * dengan aman). */
  insertedSourceRefs: string[];
  /** `retailku_party_id` yang snapshot-nya SEMPAT diubah sync ini — kalau
   * perlu rollback, snapshot-nya harus dikembalikan ke nilai SEBELUM sync
   * ini (dilampirkan di `previousSnapshotsById`), supaya sync berikutnya
   * menghitung selisih dari titik yang benar, bukan dari nilai yang
   * "sudah dianggap tersinkron" padahal transaksinya sudah dihapus. */
  touchedPartyIds: string[];
  previousSnapshotsById: Map<string, SnapshotRow | undefined>;
};

type SnapshotRow = {
  retailku_party_id: string;
  party_name: string;
  outstanding_receivable: number;
  outstanding_payable: number;
};

/**
 * Sinkronisasi piutang/utang Retailku (get_ar_ap) -> `debts` lokal.
 * TIDAK dibungkus BEGIN/COMMIT SQL (lihat "Bug ditemukan live" di
 * retailku-cashflow-sync.md — @tauri-apps/plugin-sql tidak mendukung itu
 * dengan aman) — caller (`sync-all.ts`) melakukan rollback MANUAL kalau
 * jalur lain gagal, memakai `insertedSourceRefs`/`touchedPartyIds`/
 * `previousSnapshotsById` yang dikembalikan di sini beserta
 * `rollbackArApSnapshots()` di bawah — lihat docs/todos/plan/
 * retailku-cashflow-sync.md bagian "Keterkaitan dengan sync
 * utang-piutang" dan "Sync AR/AP — idempotency".
 *
 * Strategi: get_ar_ap adalah SNAPSHOT (total outstanding saat ini per
 * pihak), bukan daftar transaksi baru — sync ini membandingkan snapshot
 * SEKARANG dengan snapshot TERAKHIR yang tersimpan per pihak
 * (`retailku_ar_ap_snapshot`), lalu insert `debts` HANYA untuk SELISIH
 * per pihak (piutang/utang baru netto sejak sync terakhir). Dihitung
 * per pihak dulu (bukan langsung dari total gabungan) supaya pelunasan
 * satu pihak tidak "menutupi" utang baru pihak lain yang kebetulan
 * terjadi di periode sync yang sama. Hasil akhir tetap digabung ke 2
 * kontak lokal generik ("Piutang Retailku"/"Utang Retailku") sesuai
 * keputusan — snapshot per pihak murni state internal untuk deteksi
 * selisih, BUKAN sumber kontak individual.
 */
export async function syncArAp(db: Db, input: SyncArApInput): Promise<SyncArApResult> {
  const client = await connectRetailkuMcp(input.mcpConfig);
  let parties: RetailkuArApParty[];
  try {
    const result = await getArAp(client);
    parties = result.parties;
  } finally {
    await client.close();
  }

  const previousSnapshots = await db.select<SnapshotRow[]>(
    "SELECT retailku_party_id, party_name, outstanding_receivable, outstanding_payable FROM retailku_ar_ap_snapshot"
  );
  const previousByPartyId = new Map(previousSnapshots.map((row) => [row.retailku_party_id, row]));

  const receivableContactId = await resolveGenericContactId(db, RECEIVABLE_CONTACT_NAME);
  const payableContactId = await resolveGenericContactId(db, PAYABLE_CONTACT_NAME);

  const insertedSourceRefs: string[] = [];
  const touchedPartyIds: string[] = [];
  const previousSnapshotsById = new Map<string, SnapshotRow | undefined>();

  for (const party of parties) {
    const previous = previousByPartyId.get(party.id);
    const receivableDelta = party.outstandingReceivable - (previous?.outstanding_receivable ?? 0);
    const payableDelta = party.outstandingPayable - (previous?.outstanding_payable ?? 0);

    if (receivableDelta > 0) {
      await insertDebtTransaction(db, {
        contactId: receivableContactId,
        cashAccountId: input.localCashAccountId,
        debtAccountId: input.receivableDebtAccountId,
        amount: receivableDelta,
        date: input.today,
        direction: "receivable",
        sourceRef: `${input.today}:${party.id}:receivable`,
      });
      insertedSourceRefs.push(`${input.today}:${party.id}:receivable`);
    }
    if (payableDelta > 0) {
      await insertDebtTransaction(db, {
        contactId: payableContactId,
        cashAccountId: input.localCashAccountId,
        debtAccountId: input.payableDebtAccountId,
        amount: payableDelta,
        date: input.today,
        direction: "payable",
        sourceRef: `${input.today}:${party.id}:payable`,
      });
      insertedSourceRefs.push(`${input.today}:${party.id}:payable`);
    }
    // Delta NEGATIF (pelunasan/koreksi turun) SENGAJA tidak memicu
    // apa pun di sini — pelunasan piutang/utang lokal punya jalur sendiri
    // (form/tombol "Bayar" di /debts, dilakukan manual oleh user), sync
    // ini cuma bertanggung jawab mencatat piutang/utang BARU yang muncul
    // di Retailku. Snapshot tetap di-update ke nilai terbaru di bawah,
    // supaya sync berikutnya membandingkan dari titik yang benar.

    touchedPartyIds.push(party.id);
    previousSnapshotsById.set(party.id, previous);
    await upsertSnapshot(db, party);
  }

  return { insertedCount: insertedSourceRefs.length, insertedSourceRefs, touchedPartyIds, previousSnapshotsById };
}

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

async function insertDebtTransaction(
  db: Db,
  params: {
    contactId: number;
    cashAccountId: number;
    debtAccountId: number;
    amount: number;
    date: string;
    direction: "receivable" | "payable";
    sourceRef: string;
  }
): Promise<void> {
  // Piutang baru = kas keluar ke akun debt (cash->debt), utang baru =
  // kas masuk dari akun debt (debt->cash) dengan debtAction dipaksa
  // 'payable' — sync ini SELALU berarti "piutang/utang baru", tidak
  // pernah pelunasan (lihat catatan "Delta NEGATIF" di atas), jadi tidak
  // perlu tanya settleDebtIds sama sekali. `contact_id` di baris
  // transactions TETAP diisi (dipakai applyDebtTransaction untuk
  // debts.contact_id) meski secara UI kontak ini generik, bukan per
  // pihak individual.
  const isReceivable = params.direction === "receivable";
  const accountId = isReceivable ? params.cashAccountId : params.debtAccountId;
  const transferAccountId = isReceivable ? params.debtAccountId : params.cashAccountId;

  const result = await db.execute(
    `INSERT INTO transactions (type, amount, account_id, transfer_account_id, note, date, contact_id, source, source_ref)
     VALUES ('transfer', $1, $2, $3, $4, $5, $6, 'retailku_sync', $7)`,
    [
      params.amount,
      accountId,
      transferAccountId,
      isReceivable ? "Piutang Retailku (sinkronisasi)" : "Utang Retailku (sinkronisasi)",
      params.date,
      params.contactId,
      params.sourceRef,
    ]
  );
  const transactionId = result.lastInsertId;
  if (transactionId == null) {
    throw new Error("Gagal menyimpan transaksi sinkronisasi AR/AP");
  }

  await applyDebtTransaction({
    db,
    transactionId,
    type: "transfer",
    accountId,
    transferAccountId,
    contactId: params.contactId,
    amount: params.amount,
    date: params.date,
    debtAction: isReceivable ? null : "payable",
    settleDebtIds: [],
  });
}

/**
 * Rollback manual untuk `retailku_ar_ap_snapshot` — dipanggil `sync-all.ts`
 * kalau salah satu jalur sync gagal, supaya snapshot kembali ke nilai
 * SEBELUM sync yang gagal ini (bukan nilai baru yang sempat ditulis
 * `upsertSnapshot` di atas). Party yang tadinya BELUM punya snapshot
 * (`previous === undefined`) dihapus sepenuhnya, bukan di-set ke 0 —
 * supaya sync berikutnya memperlakukannya seolah belum pernah disentuh.
 */
export async function rollbackArApSnapshots(
  db: Db,
  touchedPartyIds: string[],
  previousSnapshotsById: Map<string, SnapshotRow | undefined>
): Promise<void> {
  for (const partyId of touchedPartyIds) {
    const previous = previousSnapshotsById.get(partyId);
    if (previous == null) {
      await db.execute("DELETE FROM retailku_ar_ap_snapshot WHERE retailku_party_id = $1", [partyId]);
      continue;
    }
    await db.execute(
      `UPDATE retailku_ar_ap_snapshot
       SET party_name = $1, outstanding_receivable = $2, outstanding_payable = $3
       WHERE retailku_party_id = $4`,
      [previous.party_name, previous.outstanding_receivable, previous.outstanding_payable, partyId]
    );
  }
}

async function upsertSnapshot(db: Db, party: RetailkuArApParty): Promise<void> {
  await db.execute(
    `INSERT INTO retailku_ar_ap_snapshot
       (retailku_party_id, party_name, outstanding_receivable, outstanding_payable, updated_at)
     VALUES ($1, $2, $3, $4, datetime('now'))
     ON CONFLICT(retailku_party_id) DO UPDATE SET
       party_name = excluded.party_name,
       outstanding_receivable = excluded.outstanding_receivable,
       outstanding_payable = excluded.outstanding_payable,
       updated_at = excluded.updated_at`,
    [party.id, party.name, party.outstandingReceivable, party.outstandingPayable]
  );
}
