
# Sync Mobile ↔ Cloud ↔ Desktop (dua arah)

Dokumen kerja untuk menyambungkan `apps/mobile` ke arsitektur cloud sync yang sudah ada (`apps/worker` + D1, dipakai desktop dan MCP). Implementasi Fase 1–5 selesai pada 2026-11-04 dan sudah diuji di device bersama desktop; sisa pekerjaan ada di bagian status di bawah. Porting lokal semua tipe akun sudah selesai (lihat [porting-account.md](./porting-account.md)), jadi sync adalah fase berikutnya yang kini rampung.

## Status & TODO saat ini (ringkas)

Tujuan (diputuskan user 2026-11-03): sync DUA ARAH PENUH, HP ↔ cloud ↔ desktop. Detail tiap fase ada di "Hasil implementasi per fase", bukti uji di "Verifikasi", temuan riset di "Riset".

- [x] Putuskan tujuan sync mobile: dua arah penuh (2026-11-03).
- [x] Riset arsitektur sync yang ada dan kesenjangan mobile — lihat "Riset: arsitektur yang sudah ada" dan "Kesenjangan mobile".
- [x] Putuskan keputusan terbuka (sumber `sync_source`, penangkapan perubahan, token, pemicu, urutan fase) — lihat "Keputusan".
- [x] Riset kontrak push dan format; putuskan format `date`, `contact_id`, `source` — lihat "Riset: kontrak push dan format".
- [x] Fase 1 — fondasi skema mobile (migrasi `0011`–`0013`, helper tanggal lokal, token di `expo-secure-store`).
- [x] Fase 2 — push: client Worker, pembentuk payload, pemroses antrean, layar Settings.
- [x] Fase 3 — pull: apply berurutan FK dengan LWW, rejected log, checkpoint.
- [x] Fase 4 — pemicu otomatis (app aktif, polling antrean) dan indikator status.
- [x] Fase 5 — attachment lewat R2 (migrasi `0014`).
- [x] Verifikasi: tes SQLite asli, uji end-to-end ke `wrangler dev`, dan uji di device bersama desktop — lihat "Verifikasi".
- [x] Perbaikan Worker: balas 422 (bukan 500) saat induk FK belum ada, di 7 endpoint push — lihat "Perbaikan Worker".
- [ ] Deploy perbaikan Worker ke production (keputusan user, belum dilakukan).
- [ ] Perbaikan Worker lanjutan: cascade soft-delete akun, menunggu dua keputusan user — lihat "Perbaikan Worker".
- [ ] Dogfooding: skenario offline, lencana status, penundaan pull saat form terbuka, tombol "Kirim sekarang" yang kini redundan.
- [ ] Opsional: pull berkala saat app terbuka lama (sekarang hanya saat app aktif dan manual).
- **DI LUAR CAKUPAN AWAL — label** (mobile belum punya sistem label; entitas `labels`/`*_labels` di `/sync` diabaikan sampai porting label ada).

## Hasil implementasi per fase

Skema final tabel sync ada di [cloud-sync.md](../../tables/cloud-sync.md).

- **Fase 1 — skema.** Migrasi `0011` (`updated_at` + trigger di 11 tabel, `transactions.contact_id`), `0012` (`cloud_sync_state`, `cloud_sync_queue`, `cloud_sync_rejected_log`, trigger antrean), `0013` (konversi format `date`). Format `date` disamakan dengan desktop (`lib/utils/local-datetime.ts`), `contact_id` diisi dari form transaksi, token lewat `expo-secure-store` (`shared/cloud-sync/credentials.ts`), URL/checkpoint/penanda apply lewat `shared/cloud-sync/sync-state.ts`. `expo-secure-store` modul native: dev build harus dibuat ulang.
- **Fase 2 — push.** `worker-client.ts`, `push-request.ts` (satu-satunya tempat bentuk payload), `flush-push-queue.ts` (urutan FK: upsert induk dulu, delete anak dulu; 422 ke rejected log, 404 delete dianggap sukses, gagal jaringan menghentikan putaran, guard edit-saat-kirim). Entry yang gagal 5 kali tidak dicoba lagi oleh sync otomatis (`MAX_AUTO_ATTEMPTS`); sync manual mencobanya sekali lagi. Layar `app/settings.tsx`: URL, token, tes koneksi, antrekan semua data (dengan konfirmasi), sync manual, daftar entry gagal dan ditolak, tombol buang entry gagal.
- **Fase 3 — pull.** `pull-types.ts`, `apply-sync-response.ts`, `run-pull.ts`. LWW strict, hard delete untuk `deletedAt` (tombstone untuk baris yang tidak ada lokal tidak dihitung), coba ulang sekali per tabel (anak sebelum induk di tabel yang sama), checkpoint hanya maju kalau tidak ada baris gagal SEMENTARA. Gagal PERMANEN ("dilewati": transaksi tanpa `account_id`, dan FK gagal pada pull penuh) dicatat tapi tidak menahan checkpoint. `debtAccounts` ikut diterapkan (desktop mengabaikannya).
- **Fase 4 — pemicu dan UI.** `sync-controller.ts` (tanpa React, diuji dengan SQLite asli) dan `provider.tsx`. Pemicu: app aktif (sync penuh, minimal 15 detik antar percobaan), polling antrean tiap 5 detik saat app aktif (kirim saja), tombol manual. Pull ditunda di layar form (`isFormRoute`) karena penanda gema global. Gagal: status error dan backoff 30 detik untuk pemicu otomatis. Polling dipilih daripada `addDatabaseChangeListener` karena pendengar itu mengirim satu event JS per baris yang berubah. Indikator: baris status di Settings dan lencana di menu Lainnya. `applying_pull` di-reset saat app start (`migrate.ts`).
- **Fase 5 — attachment.** Migrasi `0014` (trigger antrean INSERT/DELETE), `attachment-transport.ts` (upload multipart dan unduhan streaming via `expo-file-system`), `pull-attachments.ts` (checkpoint terpisah, dijalankan SETELAH pull data karena butuh transaksi induk). Unduhan 404 (file hilang di cloud) dilewati permanen. Lampiran tidak punya `updated_at`/LWW.

## Verifikasi (2026-11-04)

- **Tes otomatis:** 333 tes di `apps/mobile` (trigger, antrean, apply, LWW, pull, controller, attachment) dengan SQLite asli; tsc bersih.
- **End-to-end ke `wrangler dev` terisolasi:** dua database mobile (A push, B kosong pull) identik di semua tabel, lalu edit dan hapus bolak-balik; tidak ada gema.
- **Device (Android dev) + desktop dev, terhadap D1 dev:** tes koneksi dan token terenkripsi; push; pull 6.046 baris data desktop; sync otomatis (transaksi "Test Sync Foto" sampai ke D1 dalam 5 detik tanpa menekan tombol); lampiran HP → R2 → desktop (SHA-256 file identik, tampil di UI desktop, tanggal tidak bergeser); lampiran lama dan baru dari desktop turun ke HP; edit dan hapus dari HP terbaca di desktop (dikonfirmasi user).
- **Cara verifikasi database dev:** mengikuti [checking-dev-database.md](../../../../desktop/docs/rules/checking-dev-database.md): salin DB beserta `-wal`/`-shm` ke scratchpad, query isi baris dan relasi FK, bukan hanya UI.

Pelajaran dari uji device (sudah dikoreksi di kode): (1) trigger antrean hanya menangkap perubahan SETELAH ada, jadi data lama perlu "Antrekan semua data" sekali; tombol itu mengirim ulang SEMUA baris termasuk hasil pull (hampir semuanya diabaikan Worker) sehingga diberi konfirmasi. (2) Entry yang selalu ditolak (mis. transfer tanpa akun tujuan, 400 "Invalid payload") dulu dicoba tanpa batas dan membuat lencana "menunggu" menempel. (3) 25 baris data uji lama di D1 dev tidak bisa masuk HP dan tercatat "dilewati": 13 transaksi tanpa akun, 12 baris investasi milik akun yang sudah di-soft-delete di D1, plus 1 lampiran uji yang file R2-nya hilang.

## Perbaikan Worker

- **Selesai, belum di-deploy:** `apps/worker/src/shared/parent-check.ts` (baru) memeriksa keberadaan induk FK sebelum menulis; dipasang di `category-periods`, `debts` (debt dan payment), `investments` (account, purchase, sale), dan `third-party-funds`. Induk tidak ada kini dibalas 422 dengan alasan, bukan 500. Hanya menolak kalau baris induk TIDAK ADA (tidak menyaring `deleted_at`), jadi alur yang sudah berhasil tidak berubah. Terbukti 21/21 di `wrangler dev` terisolasi (7 payload induk-hilang = 422, 14 payload valid = 201).
- **Menunggu keputusan:** cascade soft-delete akun. `deleteAccount` hanya mengisi `deleted_at` di `accounts`, sehingga baris `investment_*`, `third_party_funds`, dan `debt_accounts` milik akun itu tetap aktif (yatim), berbeda dari desktop yang hard-delete dengan cascade. Perlu diputuskan apakah `third_party_funds` dan `debt_accounts` ikut di-soft-delete dan bagaimana transaksi terkait investasi diperlakukan. Data yatim yang sudah ada perlu skrip SQL sekali jalan.
- **`sync_source` mobile tetap `pc`** (HP memakai token PC). Nilai `mobile` baru butuh token baru, migrasi D1 di sekitar 20 tabel, perluasan percabangan `!== 'pc'`, dan rebuild `CHECK` di desktop; tidak sepadan hanya untuk atribusi.


## Riset: arsitektur yang sudah ada

Sumber: [cloud-sync.md (Worker)](../../../../worker/docs/todos/done/cloud-sync.md), [README cloud-sync desktop](../../../../desktop/src/shared/cloud-sync/README.md), [README pull-sync](../../../../desktop/src/shared/cloud-sync/pull-sync/README.md), kode `apps/worker/src/shared/` dan `modules/sync/`.

- **Bentuk sebenarnya**: sync yang berjalan adalah push dari PC ke Worker/D1 lewat satu endpoint per entitas, ditambah pull `GET /sync?since=` untuk data yang masuk dari MCP. Desain "multi-device dua arah dengan banyak penulis" yang lama sudah ditandai SUPERSEDED (2026-10-22, lihat [multi-device-sync.md](../../../../desktop/docs/todos/superseded/multi-device-sync.md)). Jadi dua arah untuk mobile tidak punya desain siap pakai; yang bisa dipakai ulang adalah mekanisme push dan pull-nya.
- **Auth**: bearer token statis (`PC_SYNC_TOKEN`, `MCP_SYNC_TOKEN`), `sync_source` (`pc`|`mcp`) diturunkan Worker dari token, tidak pernah dari body. Tidak ada identitas pengguna (skala personal satu pengguna).
- **LWW**: per baris, membandingkan `updated_at` masuk dengan yang tersimpan, hanya menang kalau STRICT lebih baru. Format `YYYY-MM-DD HH:mm:ss` UTC, dibandingkan sebagai string. Klien boleh mengirim `updatedAt`; kalau tidak, Worker memakai waktu sekarang.
- **Hapus**: soft delete di D1 (`deleted_at`), dan desktop meng-hard-delete lokal saat pull menerima `deletedAt` terisi. Desktop TIDAK punya query yang memfilter `deleted_at IS NULL`, sama seperti mobile sekarang.
- **Push desktop**: antrean outbox `cloud_sync_queue` (`UNIQUE(table_name,row_id)`, `op` upsert/delete, `attempts`, `last_error`, `payload`), push langsung saat menulis (`push-on-write`), gagal masuk antrean, `retryPendingPushes` dijalankan sebelum tiap pull. `push-row/` adalah satu-satunya tempat bentuk payload didefinisikan.
- **Pull desktop**: `GET /sync?since=<checkpoint>` mengembalikan semua entitas yang `updated_at`-nya lebih baru; diterapkan berurutan mengikuti FK (grup/kategori/kontak → akun → transaksi → utang → investasi → label); checkpoint hanya maju setelah seluruh apply sukses. Attachment punya endpoint dan checkpoint terpisah (R2).
- **Pelajaran bug 2026-10-22** ([handover](../../../../../docs/handover-session/2026-10/2026-10-22-1-pull-sync-third-party-funds-root-cause-tuntas-note-not-null-fix.md)): filter incremental dapat melewatkan parent lama padahal child baru lolos, sehingga apply gagal FOREIGN KEY. Setiap fungsi apply WAJIB try/catch per baris dan mencatat ke `cloud_sync_rejected_log`, dan jangan pernah menelan error tanpa jejak (desktop sempat memakai `catch {}` kosong). Juga: kolom NOT NULL di D1 (mis. `transactions.note`) bisa jadi celah yang tidak tertangkap validasi input.
- **`sync_source` saat pull**: desktop menulis `'mcp'` secara hard-coded untuk semua baris yang datang dari cloud, jadi nilai ini bukan penentu perilaku pull; hanya atribusi.

## Kesenjangan mobile

- **Tidak ada kode sync sama sekali** di `apps/mobile/src` dan tidak ada tabel pendukung.
- **Skema**: tabel mobile tidak punya `updated_at` (kecuali `investment_accounts`), `deleted_at`, maupun `sync_source`, dan tidak ada trigger. LWW butuh `updated_at` di setiap tabel yang disync. SQLite tidak mengizinkan `ALTER TABLE ADD COLUMN` dengan default non-konstan (`datetime('now')`), jadi kolom harus ditambah nullable, di-backfill, lalu dijaga trigger (cara yang dipakai desktop di migrasi 0028).
- **Hapus**: mobile HARD DELETE di semua tempat. Itu cocok dengan perilaku lokal desktop setelah pull, jadi `deleted_at` lokal tidak wajib; yang perlu ada adalah antrean `delete` untuk memberi tahu cloud.
- **Titik tulis banyak**: perubahan data tersebar di `db.runAsync` pada puluhan fungsi `shared/*` dan layar, jadi memasang push manual di tiap tempat rawan terlewat (persis kelas bug yang menimpa desktop berkali-kali).
- **Yang tidak perlu**: label (belum ada di mobile), Retailku (`source`/`source_ref` hanya relevan di desktop).
- **Entitas yang ada di mobile dan di `/sync`**: `account_groups`, `categories`, `category_periods` (+ pivot kategori), `contacts`, `accounts`, `debt_accounts`, `transactions`, `debts`, `debt_payments`, `investment_accounts`, `investment_purchases`, `investment_sales`, `third_party_funds`, serta `transaction_attachments` (R2).

## Keputusan

Semua diputuskan user pada 2026-11-04, mengikuti rekomendasi.

1. **Identitas sumber (`sync_source`): token PC yang sama, HP terhitung `pc`.** Nol perubahan skema D1 maupun desktop; HP dan desktop tidak bisa dibedakan, dan itu diterima. Nilai `mobile` baru (butuh token baru, migrasi D1, rebuild CHECK di desktop) hanya dipertimbangkan kalau kelak perlu membedakan perangkat.
2. **Penangkapan perubahan: trigger SQLite `AFTER INSERT/UPDATE/DELETE` ke `cloud_sync_queue`.** Menangkap semua penulisan termasuk cascade FK. Wajib ada penanda "sedang menerapkan pull" supaya hasil pull tidak masuk antrean lagi (gema), dan wajib diuji bahwa aksi FK `CASCADE`/`SET NULL` memicu trigger di tabel anak.
3. **Data HP: tidak ada sama sekali** (dikonfirmasi user), data nyata hanya di desktop/D1. Jadi tidak ada keputusan migrasi data HP: pull pertama adalah snapshot penuh (`since` kosong) ke DB kosong, dan backfill push awal di fase 2 tidak diperlukan untuk data lama.
4. **Penyimpanan: `expo-secure-store` untuk token**, URL dan checkpoint di tabel `settings` mobile (dibuat di fase 1). Cek dokumentasi Expo SDK yang terpasang sebelum memilih API.
5. **Pemicu sync:** otomatis saat app kembali aktif dan setelah menulis (debounce), plus tombol manual. Tanpa pekerjaan latar belakang terjadwal.
6. **Urutan fase:** push (fase 2) sebelum pull (fase 3); keduanya diuji terhadap `wrangler dev`, bukan production, sebelum menyentuh data nyata.

## Riset: kontrak push dan format

Sumber: `apps/desktop/src/shared/cloud-sync/worker-client/` (satu-satunya definisi payload di sisi klien), `apps/worker/src/modules/*/router.ts`, `transactions/service.ts`, `shared/lww.ts`, [fix-debts-duplikasi-sync.md](../../../../worker/docs/todos/done/fix-debts-duplikasi-sync.md).

**Endpoint per entitas** (semua `POST`, bearer token; respons `{status: "ok"|"ignored"}`, HTTP 422 = ditolak validasi/FK dan dicatat ke rejected log, bukan di-retry):

| Tabel mobile | Upsert | Delete |
| --- | --- | --- |
| `account_groups` | `/account-groups` | `/account-groups/:id` |
| `categories` | `/categories` | `/categories/:id` |
| `contacts` | `/contacts` | `/contacts/:id` |
| `accounts` (+ `debt_accounts.direction` dikirim bareng sebagai `direction`) | `/accounts` | `/accounts/:id` |
| `transactions` | `/transactions` | `/transactions/:id` (respons `debtInfo`) |
| `debts` | `/debts/push` | `/debts/push/:id` |
| `debt_payments` | `/debts/payments/push` | `/debts/payments/push/:id` |
| `investment_accounts` | `/investments/accounts/push` | tidak ada |
| `investment_purchases` | `/investments/purchases/push` | `/investments/purchases/push/:id` |
| `investment_sales` | `/investments/sales/push` | `/investments/sales/push/:id` |
| `category_periods` (+ pivot, dikirim sebagai `categoryIds: [{id, categoryId}]`) | `/category-periods/push` | `/category-periods/push/:id` |
| `third_party_funds` | `/third-party-funds/push` | `/third-party-funds/push/:id` |
| `transaction_attachments` | `/attachments` | `/attachments/:id` |

- DELETE: 404 diperlakukan sukses (idempotent). `accounts`/`categories`/`account_groups` menerima body opsional (`transactionAction`, `memberAction`, `childAction` + target `reassign`) untuk menentukan nasib anak; mobile perlu memutuskan nilai apa yang dikirim dari antrean delete (default aman: `unassign`, setara `ON DELETE SET NULL` lokal).
- Bentuk payload persisnya sudah didefinisikan di `worker-client/push-*.ts` desktop (camelCase, `updatedAt` opsional berformat `YYYY-MM-DD HH:mm:ss` UTC). Mobile menyalin bentuk itu apa adanya.
- `debts`/`debt_payments`: setelah fix 2026-10-05, Worker TIDAK menurunkan debts untuk transaksi `pc`; klien wajib push baris debts sendiri (id dipakai apa adanya, `transactionId` wajib di `/debts/push`). Mobile menurunkan debts secara lokal di `shared/debts/apply-*` seperti desktop, jadi modelnya sama: mobile adalah pemilik derivasi, antrean harus memuat `debts`/`debt_payments`, dan delete-recreate pada edit harus mengirim DELETE id lama (gap yang dulu menumpuk baris di D1).
- Urutan push mengikuti FK: grup/kategori/kontak → akun → transaksi → debts/purchases/sales/third_party → payments/attachments; `/debts/push` dan `/investments/purchases/push` menolak `transactionId` null, jadi push transaksi dulu.

**Kesenjangan skema/kolom mobile vs D1:**

- `transactions` mobile TIDAK punya `contact_id`, `source`, `source_ref`, dan `updated_at`. Form mobile memakai `contact_id` hanya untuk membuat debts.
- Tipe: ID `TEXT` (UUID) dan `amount REAL` di kedua sisi, `is_active`/`is_cash_neutral` integer 0/1 vs boolean di payload (konversi di lapisan payload). Nama kolom snake_case → camelCase.
- `investment_accounts` mobile punya `updated_at` dengan format `datetime('now')`, sama dengan format D1; tabel lain belum.
- Format `date` transaksi/debts/dll BERBEDA: mobile menyimpan ISO UTC penuh (`new Date().toISOString()` → `2026-11-04T05:30:00.000Z`), desktop menyimpan waktu LOKAL tanpa zona (`YYYY-MM-DDTHH:mm`, dari `toISOString()` yang digeser offset zona). D1 menyimpan string apa adanya (validasi cuma `typeof string`), jadi tidak ada penolakan, tetapi desktop akan menampilkan jam bergeser (offset zona) dan filter tanggal per-hari bisa salah untuk data dari mobile, dan sebaliknya.
- Worker menimpa `amount` untuk transaksi penjualan/write-off investasi dengan nilai turunannya sendiri (`transactions/service.ts:618-622`); push transaksi investasi dari mobile tidak bisa mengandalkan `amount` yang dikirim.
- Update transaksi di Worker menulis `contact_id = ?9` tanpa syarat (`transactions/service.ts:631`), sementara `source`/`source_ref`/`is_cash_neutral` hanya ditimpa kalau payload eksplisit mengirimnya.

## Keputusan baru dari riset kontrak

Diputuskan user pada 2026-11-04, mengikuti rekomendasi: (1) A — format `date` mobile disamakan dengan desktop (waktu lokal `YYYY-MM-DDTHH:mm`); (2) A — tambah kolom `transactions.contact_id` nullable di mobile; (3) tidak ada kolom `source`/`source_ref` baru, pull mengabaikannya.

1. **Format `date` mobile.** Pilihan A: samakan dengan desktop (waktu lokal `YYYY-MM-DDTHH:mm`) lewat migrasi mobile + ubah semua tempat yang menghasilkan tanggal — konsisten, data HP kosong jadi tidak ada data lama yang dikonversi. Pilihan B: biarkan ISO UTC dan konversi di batas sync (payload keluar/masuk) — tidak menyentuh kode form, tapi konversi dua arah rawan salah dan tidak tertangkap trigger. Rekomendasi: A, karena HP belum punya data dan desktop adalah sumber kebenaran format.
2. **`transactions.contact_id`.** Kalau mobile tidak menyimpannya, setiap push edit transaksi dari HP menimpa `contact_id` di D1 dan desktop menjadi null (kontak hilang dari transaksi expense/transfer berutang). Pilihan A: tambah kolom `contact_id` ke `transactions` mobile (nullable) dan isi dari form/pull — benar-benar round-trip. Pilihan B: ubah Worker agar `contact_id` hanya ditimpa kalau payload eksplisit mengirim (sama pola `source`) — tidak menambah kolom mobile, tapi mengubah Worker/desktop-kontrak. Rekomendasi: A, lalu cek apakah Worker perlu perubahan hanya kalau A ternyata tidak cukup.
3. **`source`/`source_ref`/`is_cash_neutral`.** `source` sudah aman (tidak ditimpa kalau tidak dikirim); `is_cash_neutral` mobile sudah ada dan dikirim; `source_ref` hanya Retailku, tidak relevan. Rekomendasi: tidak ada kolom baru untuk `source`/`source_ref`, dan pull mengabaikannya. Perlu konfirmasi saja.

## Risiko yang sudah diketahui

- **Resolusi LWW satu detik**: `updated_at` berformat `YYYY-MM-DD HH:mm:ss` dan perbandingan strict, jadi dua edit di detik yang sama dianggap sama (edit yang datang belakangan diabaikan). Terlihat saat menguji dua perangkat dalam satu skrip; di pemakaian nyata dua perangkat jarang mengedit baris yang sama dalam satu detik.
- **Penanda gema global**: `applying_pull = 1` berlaku untuk seluruh koneksi selama pull, jadi tulisan pengguna di jendela itu tidak masuk antrean. Pemicu otomatis di Fase 4 tidak boleh menjalankan pull saat form sedang terbuka/menyimpan.

- **Gema dan loop**: tanpa penanda apply, hasil pull masuk antrean dan terkirim balik ke cloud; pada LWW strict hasilnya biasanya no-op tapi boros dan bisa menggeser `updated_at`.
- **Parent lama tidak ikut ter-pull** (bug 2026-10-22): berlaku untuk mobile juga, jadi try/catch + rejected log wajib sejak fungsi apply pertama, dan pull pertama pada HP kosong sebaiknya dari `since` kosong (snapshot penuh).
- **Logika turunan berbeda**: D1 menurunkan `debts`/`debt_payments` untuk transaksi dari MCP, desktop mendorong barisnya sendiri; pull menyalin nilai turunan apa adanya tanpa menghitung ulang. Mobile harus mengikuti kontrak yang sama dan jangan menghitung ulang `average_cost_per_unit`/`realized_pl`/`status` dari data hasil pull.
- **Konflik nyata dua perangkat**: LWW per baris bisa menimpa edit yang sah dengan edit yang lebih baru di perangkat lain; diterima di skala personal, tapi perlu dicatat di UI/dokumentasi.
- **Celah Worker yang sudah diketahui**: `apps/worker/src/modules/investments/service.ts:1021` memakai `payload.note ?? null` ke kolom `transactions.note` NOT NULL (kelas bug sama dengan third-party, belum diperbaiki); relevan begitu HP mulai menulis investasi lewat Worker.
- **Format**: sudah dibandingkan, lihat "Riset: kontrak push dan format"; perbedaan format `date` dan kolom `contact_id` menunggu keputusan di "Keputusan baru dari riset kontrak".
