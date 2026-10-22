# Handover — 2026-10-22 (sesi 1)

Lanjutan LANGSUNG dari [2026-10-21-1-pull-sync-third-party-funds-fix-lanjut-investigasi-production-stuck.md](2026-10-21-1-pull-sync-third-party-funds-fix-lanjut-investigasi-production-stuck.md) — sesi itu berakhir dengan root cause BELUM ketemu (`catch {}` kosong menelan error runtime production). Sesi ini **menuntaskan seluruh bug pull-sync `third_party_funds`**, menemukan DAN memperbaiki bug kedua yang baru ketahuan setelah fix pertama dites ulang, plus satu bug terpisah (`note` NOT NULL) yang ditemukan lewat kecurigaan user. Detail lengkap tiap bug (root cause + fix + verifikasi) sudah ditulis di [docs/todos/done/third-party-sync.md](../../todos/done/third-party-sync.md) ("Bug keenam" s/d "Bug kedelapan") — dokumen ini cuma ringkasan alur sesi + status akhir, JANGAN duplikasi detail yang sudah ada di sana.

## Ringkasan hasil sesi (kronologis)

### 1. Bug keenam — `catch {}` kosong, tidak ada cara lihat error production

Fix: `tauri = { version = "2", features = ["devtools"] }` (Cargo.toml, supaya WebView devtools F12 tetap tersedia di release build — default Tauri men-strip ini) + `catch {}` kosong di `use-pull-sync/index.ts` diisi `console.error`. User rebuild + buka devtools → error asli akhirnya terlihat: `FOREIGN KEY constraint failed (code: 787)`.

### 2. Bug ketujuh — root cause sebenarnya: parent "lama" tidak ikut ter-pull

Ditelusuri via `fetch` manual ke `/sync` production + cross-check FK tiap baris `thirdPartyFunds` terhadap array lain di response yang sama: SEMUA 37 baris merujuk SATU kontak ("Adel") yang `updated_at`-nya lebih lama dari checkpoint lokal — filter incremental `WHERE updated_at > since` otomatis melewatkannya, padahal child (baris baru) tetap lolos. **Bukan bug spesifik third_party_funds** — kelas bug ini bisa kena entity mana pun yang punya FK.

**Fix putaran pertama** (`apply-row.ts`, 9/17 koleksi): try/catch per baris → `cloud_sync_rejected_log`, gagal tidak menghentikan seluruh `runPull`. Dites via MCP — **MASIH GAGAL TOTAL**, error FK yang SAMA. Investigasi lanjutan nemu 3 baris `transaction_labels` dengan masalah IDENTIK (transaction_id lama belum ter-pull) lewat `applyLabelJunctionRow`, yang TIDAK pakai `applyRow` (PK junction beda pola) dan TIDAK ter-protect. `applyInvestmentAccountRow` + `applyCategoryPeriodRow` punya gap struktural sama.

**Fix putaran kedua**: ketiga fungsi itu dibungkus try/catch+`logRejectedRow` pola persis `applyRow`. README `pull-sync/` diupdate dengan catatan eksplisit: fungsi `apply*Row` baru WAJIB mengulang try/catch ini manual.

**Terverifikasi 3 putaran berturut-turut via MCP** (create account+fund test → pull → cek UI → hapus bersih D1+lokal → ulangi), lalu **data ASLI** (38 baris titip, kontak Adel dipertahankan) dikonfirmasi tersinkron sempurna (ID identik D1 vs lokal, `cloud_sync_rejected_log` kosong).

Commit: `09f7682` (fix putaran pertama + migrasi `0055` CHECK constraint `cloud_sync_queue` yang terlewat dari sesi 2026-10-21), `8592228` (fix putaran kedua).

### 3. Bug kedelapan — `note` opsional di skema tapi `transactions.note` NOT NULL di D1

User curiga: "AI mengira notes ini tidak wajib sehingga ada error 500". Dicek: skema MCP + validator Worker SUDAH benar (opsional/nullable). Tapi `createDirectThirdPartyFund` insert ke `transactions.note TEXT NOT NULL` pakai `payload.note ?? null` — begitu `note` tidak diisi, insert gagal NOT NULL constraint → 500. Diverifikasi langsung (panggil tool MCP tanpa `note` → `HTTP 500` persis).

Fix: `?? null` → `?? ""` khusus baris insert `transactions` (pola sudah ada di `debts/service.ts:739`, bukan keputusan baru). Deploy production (`wrangler deploy`, Version ID `970baea8-237a-45d1-a369-50171d6b1e9d`), diverifikasi ulang via MCP sungguhan — berhasil.

**Catatan BELUM dikerjakan**: `investments/service.ts:1021` punya gap IDENTIK (`payload.note ?? null` ke `transactions.note NOT NULL`) — DI LUAR SCOPE sesi ini, dicatat di `third-party-sync.md` Bug kedelapan supaya tidak hilang.

Commit: `be6ab74` ("Update bug di sisi worker").

### 4. Noise FOREIGN KEY di `wrangler dev` — DIKONFIRMASI BUKAN BUG

User laporan error FK bertubi-tubi di log `wrangler dev` setelah jalankan manual. Dicek `cloud_sync_queue` di `finance.dev.db`: 27 baris data percobaan dev LAMA (`created_at` 2026-10-17, 22-23x retry attempts, error "akun debt belum punya arah") — sama sekali tidak terkait bug third-party, cuma numpuk karena `wrangler dev` jarang nyala bareng `tauri dev` akhir-akhir ini. Dibersihkan (`DELETE FROM cloud_sync_queue`), log jadi bersih.

## Status kode saat ini

- `main` bersih, semua fix ter-commit (`09f7682`, `8592228`, `be6ab74`) DAN ter-deploy ke Worker production.
- Data dana pihak ketiga production: 38 baris asli, tersinkron sempurna D1 ↔ desktop lokal.
- `finance.dev.db` lokal: `cloud_sync_queue` sudah dikosongkan (data percobaan dev lama yang tidak relevan).
- Dokumentasi [third-party-sync.md](../../todos/done/third-party-sync.md) sudah lengkap mencatat Bug keenam s/d kedelapan dengan root cause + fix + verifikasi detail.

## Yang BELUM dikerjakan / kemungkinan tindak lanjut

User menyatakan kemungkinan tindak lanjut sesi berikutnya dari **sisi UI/UX**, bukan lanjutan debugging sync. Beberapa kandidat yang relevan berdasarkan histori sesi ini (bukan keputusan, cuma observasi yang bisa jadi starting point):

1. **Gap `investments/service.ts:1021`** (note NOT NULL, sama kelas bug dengan Bug kedelapan) — ini backend, bukan UI/UX, tapi dicatat di sini juga supaya tidak hilang kalau sesi depan balik ke sisi Worker.
2. **`docs/dogfooding/`** — kalau user ingin histori dogfooding sesi ini (bug keenam-kedelapan) juga ditulis dalam format `docs/dogfooding/` terpisah (lihat [[project_dogfooding_docs]]), belum dilakukan di sesi ini — cuma masuk ke `third-party-sync.md`.
3. **`apps/desktop/docs/todos/plan/cloud-sync-retailku-provenance-gap.md`** — file ini SEMPAT terbuka di IDE user selama sesi ini (muncul di `<ide_opened_file>`), TIDAK disentuh/dibahas sama sekali di sesi ini. Kemungkinan relevan untuk sesi berikutnya kalau user memang mau lanjut ke situ — **belum dibaca isinya**, jangan asumsikan kaitannya ke third-party-sync tanpa baca dulu.
4. **UI dana pihak ketiga** — selama sesi ini SEMUA verifikasi dilakukan lewat SQLite CLI + wrangler + MCP, user cuma sempat lihat tab "Data" & "Akun" dana pihak ketiga sekilas lewat screenshot (tidak ada eksplorasi UI/UX mendalam). Kalau tindak lanjut memang soal UI/UX fitur ini, sesi berikutnya kemungkinan perlu MULAI dari riset/audit UI yang sudah ada (belum ada riset UI/UX sama sekali untuk `third_party` sejauh dokumentasi proyek ini).

## Catatan proses (feedback untuk sesi berikutnya)

- **Pola investigasi "fix lalu verifikasi ulang, JANGAN asumsikan fix pertama sudah cukup" terbukti krusial lagi di sesi ini** — fix putaran pertama (`applyRow`) terlihat lengkap dan masuk akal, tapi dites ulang via MCP TETAP gagal dengan error identik. Kalau waktu itu langsung percaya fix pertama tanpa dites ulang, bug kedua (3 fungsi `apply*Row` lain yang tidak ter-protect) tidak akan ketemu sampai entah kapan. **Pertahankan pola ini**: tiap kali fix bug "parent lama belum ter-pull" sejenis, cek SEMUA jalur `apply*`, bukan cuma yang baru dicurigai.
- **Siklus test-hapus-ulang via MCP + `wrangler d1 execute` + `sqlite3` CLI langsung terbukti efektif** untuk verifikasi end-to-end cloud sync tanpa perlu nunggu user manual tiap kali — dipakai berulang kali sesi ini (4 putaran test third-party + 1 putaran test note), selalu dengan urutan DELETE child→parent yang benar dan konfirmasi "tidak ada referensi lain" sebelum hapus kontak/akun.
- **User secara proaktif mengoreksi dugaan AI yang salah** ("AI mengira notes ini tidak wajib...") dan itu benar — jangan terlalu cepat menganggap skema yang terlihat benar (opsional di Zod + validator) otomatis berarti seluruh jalur aman; kolom NOT NULL di DB bisa jadi gap tersembunyi yang terpisah dari validasi input.
