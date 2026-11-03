# Handover — 2026-11-03 (sesi 2)

Sesi ini mem-porting tipe akun **Dana Pihak Ketiga** (`third_party`) desktop → mobile (`apps/mobile`) dari nol sampai selesai, setelah porting investasi ditutup di [handover sesi 1](2026-11-03-1-porting-investasi-mobile-tahap-b-selesai-penjualan-settle-writeoff.md). Dengan ini **semua tipe akun (cash, debt, investment, third_party) sudah diporting ke mobile**. Dokumen kerja [porting-account-third-party.md](../../../apps/mobile/docs/todos/done/porting-account-third-party.md) sudah dipindah ke `done/`.

## Status git saat handover

**Belum ada yang di-commit sesi ini** — semuanya masih perubahan di working tree (mobile + docs), ditambah sisa dari sesi 1 yang juga belum di-commit (pemindahan dokumen investasi ke `done/`, komentar guard, handover sesi 1). Saran commit terpisah: (a) sisa investasi sesi 1, (b) porting dana pihak ketiga.

## Peta kode

- **Skema** — `lib/database/migrations/0010_third_party_funds.ts` (didaftarkan di `migrations/index.ts`), dokumen tabel `apps/mobile/docs/tables/third-party-fund.md`. Tanpa `updated_at`/`deleted_at`/`sync_source`; mobile HARD DELETE.
- **Logic** — `shared/third-party-funds/`: `third-party-fund.ts` (`recordThirdPartyFund`, `recordThirdPartyTransfer`, `updateThirdPartyFund`, `detachThirdPartyFundsForDeletedTransaction`, `deleteThirdPartyFundEntry`, `getTransactionThirdPartyFund`, dua kelas error), `third-party-fund-math.ts` (`getRemainingThirdPartyFund`, param opsional `excludeFundId`), `third-party-fund-queries.ts` (akun, ringkasan per kontak × akun, riwayat, satu baris), `cashflow-filter.ts` (`EXCLUDE_THIRD_PARTY_TRANSACTIONS_SQL`). 4 berkas test SQLite asli.
- **Layar** — `app/third-party/index.tsx` (statistik, tombol Titip/Ambil/Pindah, ringkasan per kontak, akun, riwayat dengan hapus), `record.tsx`, `move.tsx`, `[id]/edit.tsx`. Komponen dan form di `features/third-party/{content,form}/`. Entri di `app/(tabs)/more.tsx`.
- **Akun** — `AccountForm`: tipe akun jadi `FormFieldSelect` (permintaan user), opsi "Dana Pihak Ketiga", Saldo Awal disembunyikan dan dipaksa 0 (aturan desktop; zod refine menolak ≠ 0), prop `hideThirdPartyType`. Badge amber di `lib/account-types.ts`.
- **Titik sambung** — `shared/debts/classify-account-pair.ts` (`third_party-third_party`; `cash↔third_party` sengaja tetap ditolak), `apply-debt-transaction.ts` (guard no-op untuk pasangan itu), `account-picker-sheet.tsx` (dua query `NOT IN ('investment','third_party')`), `app/accounts/[id]/edit.tsx` (guard hapus akun, pesan blokir Balance Correction, daftar tujuan reassign tidak lagi menawarkan investasi/third_party), `app/transactions/[id]/edit.tsx` (hapus memanggil detach, edit diblok), `use-month-summary.ts` dan `use-transaction-summary.ts` (filter cashflow).
- **Generalisasi** — `FormFieldContact` (`features/transactions/form/fields/`) kini generik (prop `name`, `label`) supaya form Pindah bisa memakainya dua kali. `StatItem` dan `formatDate` dari `features/investments/content/` diimpor langsung oleh layar third-party (belum dipindah ke `components/`).

## Keputusan user sesi ini

1. **Titip/ambil/pindah hanya lewat layar khusus**, TIDAK lewat form transaksi utama; akun `third_party` disembunyikan permanen dari picker akun form transaksi (pola sama investasi).
2. **Satu layar tanpa tab** (ringkasan, akun, riwayat) plus layar form `record`, `move`, dan `[id]/edit`.
3. **Edit hanya baris direct** (nominal/tanggal/catatan); baris transfer hanya bisa dihapus (pasangannya ikut terhapus); hapus akun dengan riwayat ditolak total; Koreksi Saldo ditolak; edit transaksi `third_party` lewat form umum diblok.
4. **Tabel lokal tanpa kolom sync**, hard delete.
5. **Tipe Akun dan Jenis Pindah dipakai sebagai select**, bukan toggle (empat/tiga opsi tidak muat satu baris di layar sempit). Toggle Titip/Ambil dibiarkan (dua opsi).

## Aturan bisnis yang dipegang

- Titip = `income`, ambil = `expense`, keduanya satu sisi pada akun `third_party`; kas pribadi tidak tersentuh. Transfer hanya `third_party → third_party` (dua baris: `out` di sumber, `in` di tujuan, kontak independen).
- Sisa titipan selalu `SUM(in) − SUM(out)` per `(account_id, contact_id)`, tidak disimpan. Ambil/pindah melebihi sisa ditolak (`InsufficientThirdPartyFundError`), divalidasi SEBELUM menulis, dalam satu transaksi SQLite.
- **Guard tambahan yang TIDAK ada di desktop**: menghapus atau mengurangi nominal sebuah titipan yang sebagian sudah diambil/dipindahkan diblok (`ThirdPartyFundEditBlockedError`), karena sisa kontak itu bisa negatif. Menghapus baris `out` selalu boleh.
- Saldo awal akun `third_party` selalu 0 (setiap rupiah harus bisa ditelusuri ke kontak).
- Cashflow: transaksi akun `third_party` dikecualikan dari agregat Pendapatan/Pengeluaran lintas akun; saldo per akun dan daftar transaksi tetap menampilkannya.

## Temuan / jebakan sesi ini

1. **`transactions.note` NOT NULL di mobile**, `third_party_funds.note` boleh NULL. Fungsi `record*`/`update*` menulis `note ?? ""` ke transaksi. Ini sempat menggagalkan 18 test sebelum ketemu.
2. **`transactions.account_id` juga NOT NULL.** Tapi opsi "Lepas Saja & Hapus" di layar hapus akun (`app/accounts/[id]/edit.tsx`, `unassignAndDelete`) menjalankan `UPDATE transactions SET account_id = NULL` — kemungkinan error di device. **Belum diverifikasi**, bukan bagian porting ini, kemungkinan bug lama.
3. **Typed routes Expo basi lagi** tiap menambah route baru (`/third-party/move`, `[id]/edit`): regenerasi dengan `CI=1 timeout 50 npx expo start --port 8099 --offline`, lalu `npx tsc --noEmit`.
4. Seed test: `INSERT INTO transactions` butuh `note` dan `account_id` non-NULL.
5. `getRemainingThirdPartyFund` memakai `id != ''` untuk kasus tanpa `excludeFundId` (UUID tidak pernah kosong).

## Verifikasi

- `npx tsc --noEmit` bersih; `npx vitest run`: **257 test lulus**, 33 berkas (naik dari 222 di akhir sesi 1).
- **Dicoba di device (konfirmasi user)**: titip muncul di daftar Transaksi tapi tidak menambah Pendapatan; hapus transaksi titipan yang sudah sebagian diambil ditolak; hapus transaksi ambil berhasil dan sisa pulih; edit transaksi titip lewat form umum diblok; hapus akun yang masih punya riwayat ditolak.
- **Belum dikonfirmasi eksplisit di device (hanya test SQLite asli)**: ketiga jenis Pindah, edit baris direct dari layar Dana Pihak Ketiga, hapus baris pindah dari riwayat, saldo awal dikunci 0 di form akun.

## Belum dikerjakan / pilihan terbuka

1. **Commit** (lihat Status git).
2. **Pesan blokir Balance Correction** menyebut "layar Dana Pihak Ketiga"; sudah ada sekarang, tapi teks belum diperiksa di device.
3. **Di luar cakupan, sengaja ditunda**: sync (`sync_source`, `deleted_at`, antrean push; bug pull `third_party_funds` di production desktop juga masih belum terselesaikan — lihat memory), Koreksi Nominal granular per baris, edit baris transfer.
4. **Sisa dari sesi 1** (belum dijawab user): kosmetik investasi (pemisah ribuan field unit, pembulatan harga rata-rata, P/L nol netral), indikator nilai pasar basi, validasi inline unit > sisa, pilihan ESLint desktop.
5. **Kandidat refactor kecil**: pindahkan `StatItem` dan `formatDate` ke `components/` / `lib/` karena sekarang dipakai dua fitur.
6. Temuan #2 di atas (`account_id` NOT NULL vs unassign) — cek dan perbaiki kalau ternyata error.

## Memory yang ditulis/diupdate sesi ini

- `project_third_party_dedicated_screens_only` — dana pihak ketiga permanen hanya lewat layar khusus; guard picker permanen.

## Cara melanjutkan (saran urutan)

1. Minta user commit (dua commit terpisah disarankan), lalu `npx vitest run` dan `npx tsc --noEmit` di `apps/mobile` untuk baseline (257 test).
2. Minta user mencoba item "belum dikonfirmasi" di atas, terutama tiga jenis Pindah.
3. Tanyakan temuan #2 (apakah "Lepas Saja & Hapus" error) dan pertanyaan kosmetik sisa sesi 1.
4. Porting akun lokal sudah tuntas; fase berikutnya secara roadmap adalah sync mobile ↔ cloud (belum direncanakan, bahas dulu dengan user; ingat bug pull `third_party_funds` di production).
