# `context`

State "dialog mana yang aktif" untuk fitur Retailku, dibangun dari factory generik `createDialogContext` (`@/provider/dialog-state`) — pola sama dengan `features/transactions/dialog/context.tsx`.

Scope saat ini SENGAJA minimal: cuma buka/tutup dialog picker (`RetailkuDialogType = "picker"`). Scope besar (sync Retailku dirombak total, lihat `apps/desktop/docs/todos/plan/retailku-transaction-picker.md`) kemungkinan butuh state lebih (step pilih-tool/list/detail, tool yang dipilih, dst) — ditambah di sini bertahap seiring progres, bukan dirancang penuh di muka.

- `types.ts` — `RetailkuDialogType`.
- `context.tsx` — `RetailkuDialogProvider`/`useRetailkuDialog`, hasil `createDialogContext<RetailkuDialogType>()`.
- `index.ts` — re-export publik folder ini.
