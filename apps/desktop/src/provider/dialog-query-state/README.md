# dialog-query-state

Versi `dialog-state/` yang backing store-nya URL (query string, via `nuqs`) bukan `useState` React lokal — dialog mana yang aktif jadi tahan refresh, bisa di-deep-link, dan tersinkron otomatis dua arah dengan URL (beda dari pola manual sebelumnya di `features/transactions/page/deep-link-edit-dialog.tsx` yang butuh dua `useEffect` buat menyamakan state lokal dengan `?edit=<id>` di URL).

Tipe (`DialogState`, `UseDialogStateReturn`) di-reuse dari `../dialog-state` — bentuknya identik, cuma sumber state-nya beda.

- **`use-dialog-query-state.ts`** (`useDialogQueryState<TType>(paramName?)`) — `type`+`dataId` digabung jadi SATU query param (default `?dialog=`, mis. `?dialog=edit:42` atau `?dialog=create`) lewat parser kustom `nuqs` (`createParser`), bukan dua param terpisah — sama prinsip "satu state gabungan" yang dipegang `dialog-state/` versi lokal, supaya `type` dan `dataId` tidak bisa out-of-sync. `paramName` dikustomisasi kalau satu halaman punya lebih dari satu dialog context berbasis URL (butuh nama param berbeda supaya tidak kolisi).
- **`create-dialog-query-context.tsx`** (`createDialogQueryContext<TType>(paramName?)`) — factory `DialogProvider`+`useDialog` versi query-state, pola sama `createDialogContext` tapi dalamnya pakai `useDialogQueryState`.

Pilih modul ini (bukan `dialog-state/`) kalau dialog itu perlu di-deep-link atau tahan refresh (mis. "Edit" dari notifikasi/link eksternal yang cuma tahu id-nya). Pilih `dialog-state/` untuk dialog biasa yang cukup hidup selama sesi halaman, tidak perlu nongol di URL.
