# Edit transfer debt→cash (settlement) gagal senyap kalau melunasi piutang MILIK transaksi itu sendiri

Ditemukan saat menguji checklist "Transfer debt → cash (settlement FIFO)
via Update" di
[docs/todos/plan/unify-direct-writeoff-into-main-transaction-form.md](../../apps/desktop/docs/todos/plan/unify-direct-writeoff-into-main-transaction-form.md)
— sebelumnya belum pernah dicoba sama sekali sejak form transaksi utama
ini dibuat.

## Bagaimana ketahuan

1. Transaksi baru dibuat: transfer cash → akun debt, kontak "Adel" —
   baris `debts` baru lahir (`receivable`, `ongoing`).
2. Transaksi YANG SAMA diedit — akun dibalik jadi debt → cash, pilih aksi
   "Pelunasan piutang yang sudah ada", lalu **memilih piutang yang baru
   saja lahir dari transaksi ini sendiri** (langkah 1) sebagai target
   pelunasan.
3. Submit — toast "berhasil", TIDAK ada error.
4. Dicek lewat SQL (`docs/rules/checking-dev-database.md`): baris `debts`
   principal lama (dari langkah 1) **hilang** (sesuai alur recreate) —
   TAPI **tidak ada baris `debt_payments` yang lahir sama sekali** untuk
   transaksi ini. Tidak ada piutang Adel lain yang berubah status. Data
   pelunasan yang user maksud hilang begitu saja, tanpa jejak error.

**Dikonfirmasi scope bug HANYA edge case ini** — skenario NORMAL (memilih
piutang LAIN milik kontak yang sama, bukan piutang dari transaksi yang
sedang diedit) diuji LEBIH DULU dan terbukti bekerja benar: `debt_payments`
lahir, FIFO memilih piutang tertua dengan tepat, piutang lain tidak
terganggu.

## Root cause

`applyDebtTransactionEdit` (`shared/debts/apply-debt-transaction/edit.ts`)
untuk kasus `status.role === "principal"` + `dangerousFieldsChanged`
(akun transfer berubah, dianggap berbahaya):

```ts
if (status.hasPayments) {
  throw new DebtEditBlockedError();
}
await db.execute("DELETE FROM debts WHERE id = $1", [status.debtId]);
return mergeTouchedDebtRows(
  { deletedDebtIds: [status.debtId], ... },
  await applyDebtTransaction(input)  // <- settleDebtsFifo dipanggil DI SINI
);
```

`DELETE FROM debts` (baris principal lama) dijalankan **SEBELUM**
`applyDebtTransaction` → `settleDebtsFifo` sempat membaca `settleDebtIds`.
Kalau user memilih piutang yang IDENTIK dengan `status.debtId` (piutang
miliknya sendiri), `settleDebtsFifo` mem-query:

```sql
SELECT ... FROM debts WHERE debts.id IN (...) ORDER BY debts.date ASC
```

— baris itu SUDAH TIDAK ADA (baru dihapus satu baris di atas), jadi hasil
query kosong, loop alokasi (`for (const debt of debts)`) tidak pernah
jalan sama sekali, fungsi return `{ debtPaymentIds: [] }` tanpa exception
apa pun. Silent failure murni karena urutan eksekusi, bukan validasi yang
memang sengaja melewatkan kasus ini.

**Kenapa UI tidak mencegah ini dari awal**: `useOngoingDebts` (dipakai
`field-debt-action.tsx` untuk menampilkan daftar pilihan "Pelunasan")
sudah punya parameter `excludeDebtId`/`excludeTransactionId`, TAPI
keduanya cuma diisi untuk `debtStatus?.role === "payment"` (transaksi
yang SENDIRI adalah cicilan piutang lain) — tidak pernah untuk
`role === "principal"` (transaksi yang SENDIRI sumber sebuah piutang).
Akibatnya piutang milik transaksi yang sedang diedit ikut muncul apa
adanya di daftar pilihan, karena statusnya memang `ongoing` seperti
piutang lain.

## Dampak

- Data pelunasan (nominal yang user maksud sebagai "melunasi piutang X")
  hilang tanpa jejak — tidak ada `debt_payments`, tidak ada error, tidak
  ada entry di `cloud_sync_queue` untuk diselidiki (karena memang tidak
  ada apa pun yang coba ditulis).
- Baris `debts` principal lama tetap terhapus (bagian recreate yang
  memang seharusnya terjadi) — jadi hasil akhirnya transaksi punya
  SEMANTIK "debt→cash settlement" tapi TANPA baris `debt_payments` sama
  sekali, state yang secara desain seharusnya tidak mungkin terjadi
  (settlement selalu harus menghasilkan `debt_payments`, atau ditolak).
- Worker (`apps/worker/src/modules/debts/service.ts`, `applyDebtEditAction`)
  punya pola IDENTIK (`DELETE FROM debts` sebelum `applyDebtTransaction`)
  — gap yang sama berlaku juga untuk jalur MCP.

## Status

**DIPERBAIKI (2026-10-16), TERUJI runtime di desktop.** Dua lapis fix:

1. **Pencegahan di UI** — `useOngoingDebts` (`use-ongoing-debts.ts`) dapat
   parameter baru `excludePrincipalDebtId` (BENAR-BENAR mengeluarkan satu
   id dari daftar, beda arah dari `excludeDebtId` yang sudah ada yang
   justru MEMASUKKAN kembali piutang `paid`) — dipanggil dari
   `field-debt-action.tsx` dengan
   `debtStatus.role === "principal" ? debtStatus.debtId : undefined`.
   Piutang milik transaksi yang sedang diedit sekarang tidak pernah
   muncul sebagai opsi pelunasan untuk dirinya sendiri.
2. **Defense-in-depth di backend** — `DebtSelfSettlementError` baru:
   - Desktop (`apply-debt-transaction/edit.ts`): guard
     `if (input.settleDebtIds.includes(status.debtId)) throw ...` tepat
     sebelum `DELETE FROM debts`.
   - Worker (`debts/service.ts`): dibungkus precheck baru
     `validateDebtSelfSettlement` (pola sejajar
     `validateDebtSettlementAmount` yang sudah ada — return `rejected`,
     BUKAN throw di tengah proses tulis), dipanggil dari
     `transactions/service.ts` SEBELUM UPDATE baris `transactions`.

Diverifikasi ulang skenario PERSIS sama (transaksi baru cash→debt ke
Adel, diedit balik jadi debt→cash dengan "Pelunasan") — piutang milik
transaksi itu sendiri terbukti TIDAK LAGI muncul di daftar pilihan,
`debt_payments` baru lahir benar untuk piutang lain yang dipilih,
piutang tersebut `status='paid'`. `tsc` bersih (desktop & Worker), 246
test vitest desktop lulus.

**Belum diuji**: skenario ini via Worker/MCP (payload yang sengaja
menyertakan id debt principal sendiri di `settleDebtIds`, memverifikasi
precheck `validateDebtSelfSettlement` benar-benar me-reject sebelum
tulis apa pun).

## Catatan untuk ke depan

**Pola silent failure dari urutan delete-sebelum-proses** muncul lagi di
sini — mirip bug "ganti pasangan akun lintas domain" (lihat
[2026-10-14-transfer-ganti-pasangan-akun-silang-investment-debt-sisakan-baris-yatim.md](2026-10-14-transfer-ganti-pasangan-akun-silang-investment-debt-sisakan-baris-yatim.md))
yang juga soal "hapus baris lama SEBELUM proses yang butuh membaca baris
itu sempat jalan". Pola curiga yang layak dicek ulang di tempat lain:
tiap kali ada `DELETE`/`soft-delete` sebelum memanggil fungsi `apply*`
yang membaca ulang data dari ID yang sama — cek apakah fungsi `apply*`
itu bisa menerima ID yang baru saja dihapus sebagai input yang valid
(self-reference), dan kalau iya, apakah dia gagal KERAS (exception) atau
gagal SENYAP (silent no-op) saat itu terjadi.
