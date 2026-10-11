# dialog-state

State "dialog mana yang aktif" dalam satu fitur. Lihat `docs/rules/dialog-pattern.md` untuk aturan pemakaian penuh (trigger vs dialog, render dialog sekali di orkestrator) — ringkasan isi modul ini:

- **`use-dialog-state.ts`** (`useDialogState<TType>()`) — satu state tunggal `{ type, dataId } | null`, menggantikan pola beberapa `useState` terpisah (mis. `activeAccount` + `activeDialog`) yang berpotensi out-of-sync. `dataId` berupa string (bukan objek data penuh) — dialog fetch/derive datanya sendiri dari `dataId` lewat query yang sudah ada, supaya datanya selalu segar, bukan snapshot basi dari saat tombol diklik. Hanya satu dialog aktif dalam satu waktu, konsekuensi langsung dari satu state tunggal. Dipakai langsung kalau context dialog fiturnya sudah digabung ke context lain yang lebih besar.
- **`create-dialog-context.tsx`** (`createDialogContext<TType>()`) — factory yang membungkus `useDialogState` beserta `createContext`/`useContext`/guard error-nya jadi sepasang `DialogProvider`+`useDialog` siap pakai, supaya tiap fitur tidak perlu menulis ulang boilerplate itu. Dipanggil sekali per fitur, hasilnya di-export ulang dengan nama fitur (mis. `TransactionsDialogProvider`, `useTransactionsDialog`) — lihat `features/transactions/dialog/context.tsx`. Ini pola yang dipakai untuk kasus umum (context dialog berdiri sendiri).
- **`types.ts`** — `DialogState<TType>`, `UseDialogStateReturn<TType>`, dipakai bersama kedua file di atas.

State ini lokal (`useState` React biasa) ke `DialogProvider` yang memanggilnya — hidup selama provider itu mount, hilang saat unmount, tidak persisten lintas reload/navigasi. Context di sini cuma mekanisme membagikan state itu ke trigger dan dialog yang bisa berjauhan dalam tree yang sama, bukan state global aplikasi.
