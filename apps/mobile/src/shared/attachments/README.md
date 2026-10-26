# Lampiran transaksi (mobile)

Port dari `apps/desktop/src/shared/attachments/`, disederhanakan untuk konteks mobile.

## Perbedaan dari desktop

- **Lokal-only, tanpa cloud sync** — cloud sync belum diporting ke mobile sama sekali, jadi lampiran yang ditambah di satu device tidak muncul di device lain. Desktop push/pull bytes lampiran ke Worker (`shared/cloud-sync/push-row/push-attachment-row.ts`, `worker-client/push-attachment.ts`); mobile tidak punya ekuivalen itu.
- **Tidak ada folder custom** — desktop punya `useAttachmentFolder`/`useSetAttachmentFolder` (setting pilih folder penyimpanan). Mobile selalu simpan ke `Paths.document/transaction-attachments/` (lihat `save-attachment-file.ts`), tidak ada UI untuk mengubahnya.
- **Sumber file**: desktop pakai drag-drop + paste clipboard (web-only). Mobile pakai `expo-image-picker` (galeri + kamera) dan `expo-document-picker` (dokumen/PDF) — lihat `attachment-source-sheet.tsx`.
- **Render file**: desktop baca bytes manual lewat Tauri `invoke` lalu bikin base64 data URL. Mobile pakai URI `file://` langsung (`expo-image`'s `<Image source={{ uri }} />`) — expo-file-system sudah mengekspos file sebagai URI yang bisa dipakai langsung, tidak perlu baca-lalu-encode manual.

## Pola pending attachment (create) vs immediate-save (edit) — SAMA seperti desktop

Awalnya dicoba pendekatan "generate id transaksi sebelum form submit, langsung insert draft row" supaya attachment bisa immediate-save di KEDUA mode — dibatalkan karena perlu mekanisme "hapus draft/attachment kalau user keluar tanpa submit" yang terbukti rawan: `expo-router`'s bundled navigation core TIDAK mengimplementasikan event `beforeRemove` dari `@react-navigation/native-stack` (listener terpasang tapi tidak pernah terpanggil — dicek langsung: `grep -rl "beforeRemove"` di `expo-router/build/` nihil hasil), dan event `removed` yang memang didukung fire ASYNC setelah navigasi sudah terjadi (list sempat refetch duluan sebelum delete selesai di background, badge lampiran sempat "nyangkut" sampai refetch berikutnya).

Solusinya kembali ke pola desktop yang sebenarnya — beda titik keputusan antara create dan edit:

- **Create** (`app/transactions/new.tsx`) — `id` transaksi BELUM ada sampai user menekan "Tambah Transaksi". Lampiran yang dipilih sebelum itu di-stage sebagai `PendingAttachment` murni di state React (`pending-attachment.ts`, `pending-attachment-uploader.tsx`, `pending-attachment-thumbnail.tsx`) — render preview langsung dari URI sementara hasil picker, TIDAK disentuh ke folder permanen maupun DB sama sekali. Begitu `INSERT INTO transactions` sukses, baru di-loop `saveAttachmentToTransaction` (`save-pending-attachment.ts`) per item. Kalau user keluar tanpa submit, pending attachment otomatis lenyap bersama unmount komponen — tidak perlu cleanup eksplisit apa pun.
- **Edit** (`app/transactions/[id]/edit.tsx`) — `id` transaksi sudah pasti ada (baris existing). `AttachmentUploader` (`attachment-uploader.tsx`) immediate-save: attachment yang dipilih LANGSUNG permanen (copy file + insert DB), independen dari tombol "Simpan Perubahan". User yang berubah pikiran hapus manual lewat tombol X di thumbnail.

## Skema

Migrasi `lib/database/migrations/0002_pragma_defaults_and_attachments.ts` — tabel `transaction_attachments` (`id`, `transaction_id` FK ke `transactions.id` ON DELETE CASCADE, `file_path`, `created_at`), sama persis kolom desktop (`src-tauri/migrations/0010_transaction_attachments.sql`) minus auto-increment (pakai `TEXT` UUID v7 konsisten dengan tabel lain di mobile).

Kolom `transactions.has_attachment` (sudah ada sejak migrasi `0001`, dipakai badge 📎 di list) di-update manual oleh `save-pending-attachment.ts`/`delete-attachment.ts` — tidak ada trigger SQL, jadi SELALU lewat fungsi ini untuk insert/delete attachment, jangan query manual di tempat lain.

## File penting saat butuh menyentuh ulang

- `save-attachment-file.ts` — copy file dari URI sementara (hasil picker, di cache dir OS yang bisa dibersihkan OS) ke `Paths.document/transaction-attachments/`, nama file di-generate ulang (UUID v7 + extension asli) supaya tidak collision.
- `save-pending-attachment.ts` — fungsi non-hook `saveAttachmentToTransaction`, dipakai `use-add-attachment.ts` (edit, immediate) DAN `new.tsx` (create, setelah submit) — satu-satunya titik yang benar-benar menulis ke folder permanen + DB.
- `delete-attachment.ts` — fungsi non-hook `deleteAttachmentById`, dipakai `use-delete-attachment.ts`.
- `attachment-source-sheet.tsx` — `BottomSheetModal` pemilih sumber (Galeri/Kamera/Dokumen), `stackBehavior="push"` (lihat `feedback_gorhom_nested_sheet_stack_behavior` di memory — WAJIB untuk nested BottomSheetModal di app ini).
