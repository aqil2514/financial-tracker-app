# Handover — 2026-10-03 (sesi 3)

Lanjutan dari `2026-10-03-2-implementasi-tool-tulis-mcp-sync-source-dinamis-contact-name.md`.
Sesi ini START dari user bertanya soal data piutang MCP yang tidak
cocok dengan UI (`Rp36.137.014` vs `Rp8.946.243`), BERKEMBANG jadi:
pembersihan data sampah, implementasi fitur baru (piutang/utang tanpa
transaksi), lalu BERUBAH ARAH jadi diskusi konsep fundamental (tipe
akun) setelah user merasa ada gap arsitektur — ditutup dengan audit
kepatuhan kode lintas-app. Sesi panjang, banyak pivot — dicatat
berurutan sesuai kronologi supaya konteks "kenapa" tiap keputusan tetap
jelas.

## Ringkasan hasil sesi (kronologis)

### 1. Investigasi & pembersihan data piutang sampah (D1 production + lokal)

- User tanya kenapa `get_debt_summary` (MCP) lapor Rp36.137.014/98 baris,
  padahal UI desktop cuma nunjuk ~Rp9jt dari 3 kontak asli.
- Ditemukan: 93 baris `debts` dengan `contact_id` NULL, dibuat serentak
  (timestamp sama persis), `sync_source='mcp'` — kemungkinan besar hasil
  testing/dummy dari sesi sebelumnya yang tidak pernah dibersihkan.
- **Dibersihkan via `delete_transaction` MCP** (93x) + **manual SQL
  langsung** (`wrangler d1 execute --remote` dan SQLite lokal) untuk
  soft-delete baris `debts` yang tersisa — karena ditemukan
  `delete_transaction` TIDAK ikut soft-delete `debts` terkait (cuma
  `transaction_id = NULL`, by design — lihat `detachDebtForDeletedTransaction`).
- Ditemukan juga **3+2 baris duplikat** (piutang yang sama tercatat 2x:
  `sync_source='pc'` vs `'mcp'`, hasil bug sinkronisasi) — ikut
  dibersihkan dengan pola yang sama.
- **Root cause kenapa UI tetap salah meski data sudah bersih**: 4 hook
  baca `debts` (`use-contact-summary.ts`, `use-ongoing-debts.ts`,
  `use-contact-debts.ts`, `use-debts-list.ts`) TIDAK ADA satu pun yang
  filter `deleted_at IS NULL` — **SUDAH DIPERBAIKI** di sesi ini
  (ter-commit di `6aec81a`).
- Data test dibersihkan, verified lewat `tauri dev` + query SQL
  langsung sesuai `checking-dev-database.md`.

### 2. Brainstorming → fitur baru: piutang/utang TANPA transaksi

User tanya "memungkinkan tidak piutang terjadi tanpa transfer uang?" →
digali lebih lanjut (termasuk sisi pelunasan: barter, pemutihan,
offset) → disimplifikasi jadi 2 fitur:

- **"Mode Langsung"** di form Tambah (`new-debt-form`) — toggle "Cara
  Mencatat", insert `debts` dengan `account_id`/`transaction_id` NULL
  sejak lahir, tidak menyentuh saldo akun manapun.
- **"Selesaikan Tanpa Uang"** di form Bayar (`pay-debt-form`) — toggle
  "Cara Menyelesaikan", insert `debt_payments` dengan `account_id`/
  `transaction_id` NULL — SATU jalur sama utk barter/pemutihan/offset
  (disimplifikasi, `written_off` TIDAK jadi dibangun terpisah).
- Diverifikasi end-to-end di `tauri dev` (dev db) — 3 skenario: debt
  mode direct baru, pelunasan non-cash pada debt mode direct, pelunasan
  non-cash pada debt mode TRANSFER (kasus lebih kompleks, percabangan
  kode harus benar-benar skip jalur transfer).
- Detail lengkap rencana (termasuk 2 keputusan desain yang
  dieksplisit: toggle di form sama bukan dialog terpisah, catatan tetap
  wajib) ada di `apps/desktop/docs/todos/plan/debts-sync-and-non-transfer-debts.md`.
- **Ter-commit** di `6aec81a` bersama fix hook #1.

### 3. User merasa ada GAP — pivot ke diskusi konsep tipe akun

Setelah fitur "mode direct" jalan, user bertanya "bagaimana hubungan
`debts` ini dengan akun? Kuat tidak?" — jawabannya "lemah by design"
(`ON DELETE SET NULL`, bukan `CASCADE`) memicu pertanyaan lebih besar:
**"akun sebagai master data, solid tidak?"**.

Diskusi panjang (BUKAN implementasi, murni percakapan + 1 dokumen
baru):
- Awalnya saya coba kaitkan ke teori COA/double-entry — user TEGAS
  klarifikasi itu BUKAN maksudnya ("kalau mengacu COA, ini salah arah
  dari awal").
- User jelaskan: tipe akun itu dari **sifat nyata pengalaman pemakaian**
  (kas = likuid, debt = uang di tangan orang lain), BUKAN dari kerangka
  akuntansi formal. Tipe akan terus bertambah (investasi, dana pihak
  ketiga, valas), masing-masing bawa 2 konsekuensi: pengaruh ke laporan
  & ketersediaan fitur.
- Saya audit lapangan (grep kode) utk cari 3 celah TEKNIS konkret
  (migrasi SQLite CHECK constraint berat, logic hardcoded tersebar
  20+ lokasi, "total saldo" belum ada logic exclude tipe tertentu) —
  user terima semua sbg valid.
- Lanjut ke celah KONSEPTUAL (bukan implementasi) — user jawab 3 dari 4
  sambil jalan: (a) klasifikasi "masuk kekayaan" DIBUANG, laporan cukup
  apa adanya; (b) kasus campuran ("satu akun satu tipe" vs dompet fisik
  campuran) dijawab lewat **Grup Akun netral** (sudah ada, cuma label,
  tidak bawa logic); (c) tipe statis dijawab via pola **status terpisah
  dari tipe** (persis pola `debts.status` yg sudah ada); (d) salah pilih
  tipe di awal → disepakati **Opsi C**: boleh ubah SEBELUM ada transaksi,
  terkunci SESUDAHNYA.
- Saya tulis semua ke `docs/concept/konsep-tipe-akun.md` (BARU, root
  `docs/`, bukan di `apps/desktop/docs/`) — lalu di-review ulang
  bersama: user tanya "solid untuk jangka panjang?" → saya identifikasi
  3 celah SISA (1 di antaranya user bilang "itu fitur turunan, bukan
  celah konsep" — disepakati). 2 sisanya (migrasi tipe akun skala
  besar, kriteria status-vs-tipe-baru) **TETAP belum terjawab** — user
  minta ditulis sbg **disclaimer eksplisit** di penutup dokumen: dokumen
  ini solid sbg RUJUKAN, tapi BUKAN rulebook prosedural lengkap, jadi
  kasus yang tidak cocok persis WAJIB didiskusikan dulu sebelum
  diimplementasikan.
- **Ter-commit** di `6aec81a` bersama 2 poin sebelumnya (pesan commit:
  "Fix debts dan konsep tipe akun baru sebagai rujukan awal").

### 4. Audit kepatuhan kode lintas-app terhadap konsep baru

User minta: audit SEMUA kode (lintas `apps/desktop`, `apps/worker`,
`apps/mcp-server`) terhadap `konsep-tipe-akun.md`, catat temuan SAJA
(solusi ditunda sesi depan), simpan di `docs/todos/plan/` (root), lalu
buat handover ini.

- Dijalankan via 1 Explore agent (background task, selesai sebelum
  dokumen ditulis) — scope: 7 prinsip dari dokumen konsep, dicek satu
  per satu dgn grep+read lintas 3 aplikasi.
- **Temuan utama** (ringkasan lengkap di dokumen — lihat file):
  1. "Akun sebagai tumpuan" MENYIMPANG di 3 jalur: (a) fitur mode
     direct sesi ini sendiri, (b) **sync Retailku SUDAH LEBIH DULU**
     bikin `debts`/`debt_payments` tanpa `account_id` (independen,
     sudah ada sejak lama, dikonfirmasi lewat komentar migrasi
     `0025_debts_source_ref.sql`), (c) MCP `create_transaction` tidak
     mewajibkan `accountId` (beda dari form desktop yg wajib).
  2. "Satu akun satu tipe" belum menyimpang langsung, tapi BANYAK logic
     (desktop + Worker) dibangun dgn asumsi biner cash/debt — rawan
     silent-wrong begitu tipe ketiga ditambahkan.
  3. "Tipe terkunci setelah dipakai" **BELUM diimplementasikan sama
     sekali** di lapisan manapun (desktop/Worker/MCP) — gap murni,
     bukan bug 1 lokasi.
  4. "Laporan apa adanya" — SUDAH SESUAI, tidak ada temuan (dashboard
     total balance jumlah semua akun tanpa filter, konsisten).
  5. Peta 20+ lokasi hardcoded `'cash'`/`'debt'` lintas 3 app — bukan
     pelanggaran, tapi peta risiko kalau tipe baru ditambahkan.
  6. Desktop vs Worker/MCP **TIDAK PARALEL** — fitur "mode direct" cuma
     ada di desktop, tidak ada tool MCP setara. Worker bahkan tidak
     punya controller/router `debts` sendiri.
  7. Skema SQL vs kode TS — KONSISTEN, tidak ada kontradiksi (kolom
     memang nullable sejak desain awal skema, baru "melanggar prinsip"
     setelah prinsipnya dirumuskan belakangan).
- Ditulis ke `docs/todos/plan/audit-kepatuhan-konsep-tipe-akun.md`
  (BARU, root `docs/`) — format: ringkasan tabel status per prinsip,
  detail per temuan dgn lokasi file persis, lalu 7 pertanyaan terbuka
  utk sesi solusi berikutnya (SENGAJA tidak dijawab sesi ini).

## Status kode saat ini

- **Semua perubahan kode (fitur debts non-transfer) + dokumen konsep
  SUDAH ter-commit** oleh user sendiri di `6aec81a` ("Fix debts dan
  konsep tipe akun baru sebagai rujukan awal") — commit ini terjadi DI
  LUAR permintaan eksplisit saya, ditemukan saat cek `git log` di akhir
  sesi.
- `docs/todos/plan/audit-kepatuhan-konsep-tipe-akun.md` — **BELUM
  ter-commit**, baru dibuat di sesi ini.
- `docs/todos/plan/cloud-sync-mcp.md` **dipindah user sendiri** (di
  luar sesi ini) ke `docs/todos/done/cloud-sync-mcp.md` — terdeteksi
  dari `git status` (tercatat "deleted" di working tree + file baru
  untracked di `done/`), TIDAK disentuh oleh saya, dicatat di sini
  murni sbg konteks kalau nanti perlu di-commit juga.
- 3 dokumen rencana lain yang relevan dari sesi ini (SEMUA sudah
  ter-commit di `6aec81a`):
  - `apps/desktop/docs/todos/plan/debts-sync-and-non-transfer-debts.md`
  - `docs/concept/konsep-tipe-akun.md`
  - `docs/concept/konsep-utang-piutang.md` (TIDAK diubah sesi ini,
    cuma dibaca sbg referensi gaya penulisan)

## Gap yang TERSISA untuk sesi berikutnya

1. **7 pertanyaan terbuka di `audit-kepatuhan-konsep-tipe-akun.md`**
   (lihat dokumen, bagian penutup) — BELUM dijawab sesuai permintaan
   eksplisit user ("solusinya nanti dulu"). Daftar singkat:
   - Nasib fitur "mode direct" (dipertahankan dgn `account_id` tetap
     wajib tapi skip transaksi, atau dirombak/dihapus?).
   - Sync Retailku yang sudah lama bikin `debts` tanpa `account_id` —
     dianggap pengecualian sah (beda konteks, data eksternal) atau perlu
     diselaraskan juga?
   - `accountId` opsional di MCP `create_transaction` — disamakan wajib
     spt form desktop?
   - Asumsi biner cash/debt di banyak tempat — refactor ke abstraksi
     generik SEBELUM tipe ketiga datang, atau tambal satu-satu nanti?
   - Guard "tipe terkunci setelah dipakai" — diimplementasikan di level
     mana (trigger DB/validasi TS desktop/validasi Worker/ketiganya)?
   - 20+ lokasi hardcoded — disentralisasi jadi registry per-tipe, atau
     tetap tersebar?
   - Paralelitas desktop vs Worker/MCP — "mode direct" perlu
     direplikasi ke MCP, atau sengaja dibatasi cuma desktop?
2. **Belum diverifikasi**: apakah baris `debts` hasil "mode direct"
   (yang baru dibangun sesi ini) ikut ter-push ke Worker lewat
   `push-row.ts`, dan kalau iya apakah Worker-side bisa menampungnya
   dgn `account_id`/`transaction_id` NULL tanpa error — disebut
   eksplisit sbg "perlu dicek di sesi solusi nanti" di dokumen audit,
   TIDAK diverifikasi sesi ini (scope-nya audit kode statis, bukan
   testing end-to-end sync).
3. **Commit untuk `audit-kepatuhan-konsep-tipe-akun.md`** — belum
   dilakukan, menunggu user (pola sesi-sesi sebelumnya: user commit
   sendiri, bukan diminta eksplisit ke saya).
4. **`docs/todos/plan/cloud-sync-mcp.md` yang dipindah ke `done/`** —
   kalau user belum commit perpindahan ini, masih nganggur di working
   tree sbg "deleted" + file baru untracked.

## Catatan proses (feedback utk sesi berikutnya)

- **Sesi ini banyak pivot arah, SEMUA dipicu user, bukan inisiatif
  saya** — dari "cek data MCP" → "bersihkan sampah" → "bangun fitur
  baru" → "ternyata ada gap konsep" → "audit kepatuhan". Pola yang
  bagus utk ditiru: setiap kali user merasa ada yang "janggal" (gap
  arsitektur, bukan sekadar bug), BERHENTI dari eksekusi, diskusikan
  dulu sampai tuntas sebelum lanjut implementasi — persis yang terjadi
  di titik 3 (user eksplisit STOP tool use utk ngobrol dulu soal akun).
- **User punya preferensi KUAT: pisahkan audit/temuan dari solusi.**
  Diulang 2x secara eksplisit sesi ini — sekali di level fitur ("solusi
  nanti dulu" soal gap debts-account), sekali lagi di level dokumen
  audit ("catat temuan SAJA, solusinya nanti"). Jangan gabungkan kedua
  fase ini di masa depan kalau user minta "audit dulu" — tahan godaan
  utk langsung kasih rekomendasi perbaikan.
- **User mengoreksi arah diskusi dgn tegas kalau salah tangkap** —
  waktu saya coba kaitkan konsep tipe akun ke teori COA/double-entry,
  user langsung bilang "ini sudah salah arah dari awal" sebelum saya
  lanjut. Bagus utk pola ke depan: kalau user kasih sinyal serupa,
  JANGAN coba "menyelamatkan" interpretasi lama dgn reframing kecil —
  dengarkan dulu penjelasan ulang tanpa asumsi.
- **Validasi "solid tidak" dari user itu bentuk STRESS-TEST, bukan
  cuma minta approval** — user beberapa kali tanya "solid tidak?" lalu
  saya diminta cari CELAH NYATA (bukan puja-puji), lalu user sendiri
  yang evaluasi apakah celah itu valid atau bisa diselesaikan dgn
  mudah ("itu bisa jadi fitur turunan", "itu urutan kejadian, bukan
  celah konsep"). Pola diskusi: saya cari celah dgn bukti konkret (grep
  kode, bukan spekulasi abstrak), user yang putuskan mana yang serius.
- **Working tree di-commit oleh user sendiri TANPA pemberitahuan
  eksplisit ke saya di tengah sesi** — baru ketahuan saat saya cek
  `git log`/`git status` di akhir sesi utk nulis handover ini. Untuk
  sesi depan: SELALU cek `git status`/`git log` di awal sesi (bukan
  cuma asumsi dari ingatan percakapan) sebelum melaporkan status kode,
  krn user bisa commit kapan saja di luar permintaan eksplisit.
