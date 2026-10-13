# `lib/db`

Barrel (`index.ts`) untuk koneksi SQLite (`getDb`, di `get-db.ts`) +
semua tipe baris tabel (`types.ts`). Import tetap `@/lib/db` dari
pemanggil manapun — folder ini transparan, tidak perlu ubah import
lama.

## `get-db.ts`

- `DB_FILE` beda nama file (`finance.dev.db` vs `finance.db`) antara
  dev dan production — dibedakan lewat `NODE_ENV`, BUKAN
  `TAURI_ENV_DEBUG` (`TAURI_ENV_DEBUG` cuma tersedia saat proses build,
  tidak di WebView runtime). `next dev` (dipakai `tauri dev` lewat
  `beforeDevCommand`) selalu `NODE_ENV=development`, `next build`
  (dipakai `tauri build`) selalu `NODE_ENV=production` — jadi ini cara
  paling andal membedakan keduanya DI RUNTIME JS. Tanpa pemisahan ini,
  `tauri dev` dan hasil build/installer production berbagi file
  database yang sama persis.
- SQLite mematikan foreign key enforcement secara default per koneksi
  — `PRAGMA foreign_keys = ON` WAJIB diaktifkan ulang di sini setiap
  kali database dibuka, tidak cukup lewat migrasi (PRAGMA di migrasi
  hanya berlaku untuk koneksi yang menjalankan migrasi itu, bukan
  koneksi-koneksi berikutnya).

## `types.ts`

Field dengan catatan non-obvious:

- `Account.icon` — nama komponen lucide-react (mis. `"Wallet"`), lihat
  `lib/account-icons.ts` — `null` kalau belum dipilih (fallback ke icon
  default saat dirender).
- `Account.color` — nama warna dari palet TERBATAS, lihat
  `lib/account-colors.ts` — `null` kalau belum dipilih (fallback ke
  warna default saat dirender). Independen dari `icon`: bentuk dan
  warna dipilih terpisah.
- `Transaction.description` — JSON dokumen Tiptap terserialisasi
  (`JSON.stringify`), atau `null` kalau belum diisi — deskripsi detail,
  terpisah dari `note`.
- `Contact.note` — JSON dokumen Tiptap terserialisasi (`JSON.stringify`),
  atau `null` kalau belum diisi.
- `Debt.type` — `"receivable"` = piutang (orang lain berutang ke saya),
  `"payable"` = utang (saya berutang ke orang lain).
- `Debt.transaction_id` — jejak transaksi transfer otomatis yang
  membuat piutang/utang ini.
- `DebtPayment.transaction_id` — jejak transaksi transfer otomatis
  untuk cicilan/pelunasan ini.
