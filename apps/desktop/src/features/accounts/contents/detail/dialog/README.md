# Dialog state tab Detail

Backing store URL (`createDialogQueryContext`, bukan `dialog-state/` lokal) — dialog row-level (Detail/Edit/BalanceCorrection/Delete) jadi bisa di-deep-link (`?dialog=edit:<accountId>`), tahan refresh.

`dataId` SELALU `account.id` (string), BUKAN objek `AccountWithBalance` penuh seperti context lama (`sections/list/context/`). Tiap dialog resolve datanya sendiri dari `useAccounts()` (react-query cache, bukan network round-trip baru) — konsisten dengan filosofi `provider/dialog-query-state/README.md`: "selalu fresh, bukan snapshot basi".

## Kenapa bukan `dialog-state/` biasa

Dialog row-level di sini perlu bisa dibuka lewat link langsung (mis. tombol "Edit" dari notifikasi atau halaman lain yang cuma tahu `accountId`-nya) — itu kebutuhan yang sama persis dengan alasan modul `dialog-query-state/` dibuat, lihat READMEnya.

## `AccountDialogType`

- `create` — form "Tambah Akun" (reuse `AccountFormDialog`, sebelumnya trigger di `PageHeader actions`, sekarang pindah ke sini).
- `detail` — ringkasan read-only akun (`AccountDetailDialog`).
- `edit` — form edit, implementasi SENDIRI (native `Dialog` + `AccountForm`/`useUpdateAccount` dari `contents/detail/form`) — BUKAN reuse `AccountEditDialog` lama di `features/accounts/dialogs/edit-dialog/` (itu tetap ada terpisah, dipakai lintas fitur oleh `features/investment-detail/header`, lihat `../../../dialogs/README.md`).
- `balance-correction` — koreksi saldo (`AccountBalanceCorrectionDialog`).
- `delete` — konfirmasi hapus (`DeleteAccountDialog`).
