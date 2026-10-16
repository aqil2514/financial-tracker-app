# Handover — 2026-10-16 (sesi 1)

Sesi dogfooding manual jalur Utang Piutang, dipicu kecurigaan user ("ada bug di jalur utang piutang") tanpa gejala spesifik di awal. Direproduksi langsung di `tauri dev` sambil verifikasi tiap langkah ke `finance.dev.db` (pola [docs/rules/checking-dev-database.md](../../rules/checking-dev-database.md)), root cause ditemukan, sempat dicoba 1 pendekatan fix yang ternyata rapuh dan DIBUANG, lalu naik ke rancangan skema yang lebih kokoh — didokumentasikan sebagai plan, BELUM diimplementasikan. Worker/MCP dikonfirmasi kena gap yang sama lewat pengecekan kode langsung (bukan diasumsikan).

## Ringkasan hasil sesi (kronologis)

### 1. Baseline & reproduksi — jalur Piutang dicoba dulu, TERBUKTI benar

User menambah 2 baris baseline manual (piutang Adel Rp10.000, utang Adel Rp10.000), lalu dites pelunasan piutang lebih dulu ("Pelunasan Piutang"). Awalnya dicurigai bug di `debt_payments.account_id` (menyimpan akun sumber "Piutang", bukan akun kas tujuan) berdasarkan baca kode `settle-fifo.ts` — TAPI setelah user tunjukkan screenshot UI riwayat cicilan, ternyata itu BUKAN bug: kolom "akun" di situ MEMANG dimaksud menampilkan akun piutang/debt-nya, bukan akun kas tujuan. Piutang Adel berstatus "Lunas" dengan benar di UI.

### 2. Jalur Utang — bug nyata ditemukan & dikonfirmasi lewat saldo

User pindah uji ke jalur Utang: tanya baseline saldo "Dompet Bebas" dulu (dihitung manual pakai query PERSIS sama dengan `useAccountBalances`: Rp209.865,30), lalu melakukan pelunasan utang Adel Rp10.000 lewat UI. Ekspektasi user: saldo turun jadi ~Rp199.865. **Saldo aktual: Rp219.865,30 — selisih +Rp20.000, naik padahal seharusnya turun.**

Ditelusuri ke transaksi "Utang Baru Test" (pembuatan utang awal, dari "Tambah Utang/Piutang") — `debt_account_id`-nya ter-prefill ke akun **"Piutang"**, padahal entrinya payable (Utang). `classifyAccountPair` tidak peduli identitas akun debt, cuma arah transfer — jadi baris `debts` tetap tersimpan `type='payable'` sesuai permintaan form, TAPI `account_id`-nya salah kategori. Efek rantai: saat dilunasi, `settleDebtsFifo` + rumus `useAccountBalances` memperlakukan transaksi ini seolah PENERIMAAN piutang (nambah kas), bukan PEMBAYARAN utang (ngurangin kas).

**Root cause**: `new-debt-form.tsx` — dropdown "Akun Utang Piutang" menampilkan SEMUA akun `account_type='debt'` tanpa filter arah, dan auto-prefill ambil akun debt pertama tanpa pertimbangan `debt_type`. Detail lengkap, termasuk query SQL reproduksi penuh, ada di dogfooding doc (poin 3 di bawah).

### 3. Dogfooding doc ditulis

[docs/dogfooding/2026-10-16-form-utang-piutang-dropdown-akun-debt-tidak-difilter-per-jenis.md](../../dogfooding/2026-10-16-form-utang-piutang-dropdown-akun-debt-tidak-difilter-per-jenis.md) — reproduksi step-by-step, root cause, dampak (saldo salah arah tanpa error apa pun), status **BELUM DIPERBAIKI**.

### 4. Riset konvensi existing (agent Explore, background)

Sebelum merancang fix, didelegasikan riset: apakah ada pembedaan struktural piutang/utang di skema `accounts`? Jawaban: **tidak ada** — pembedaan cuma dari kolom `debts.type`, akun debt memang didesain generik 2-arah (`docs/concept/konsep-tipe-akun.md`). `classifyAccountPair` murni berbasis `account_type` mentah, tidak pernah lihat nama/identitas akun.

**Temuan paling penting**: bug ini BUKAN kasus baru — migrasi `0033_backfill_direct_debt_transactions.sql` kategori D punya insiden IDENTIK di data produksi ("Piutang Retailku" ternyata `account_id` salah ke akun "Piutang"), dikonfirmasi user sendiri waktu itu sebagai "SALAH INPUT sejak awal", ditambal manual. Pola berulang — sinyal kuat butuh perbaikan struktural, bukan tambal data lagi.

Dicek juga lewat query manual ke `finance.dev.db`: **2 baris `debts` lama sudah salah kategori di luar sesi uji coba** — `01a13e62-cf6d...` (payable, Rp10.000, kontak **Kak Ipit**, akun "Piutang", masih `ongoing`, tanggal 2026-10-15 — DATA RIIL, bukan test) dan `01a14492-eb7f...` (dari sesi uji coba ini). Yang pertama belum pernah dibayar jadi belum sempat merusak saldo, tapi akan kena bug yang sama kalau dilunasi tanpa fix.

### 5. Percobaan pertama ("warning UI non-blocking") — DICOBA, DIBUANG

User diajak pilih scope fix lewat AskUserQuestion, memilih "warning UI saja" (tanpa constraint keras/skema baru) atas pertimbangan desain "1 akun debt boleh 2 arah" memang sengaja. Diimplementasikan: hook baru `use-debt-account-usage.ts` (histori `COUNT` per akun+arah dari `debts`), dipakai `new-debt-form.tsx` untuk urutan dropdown + prefill "cerdas" + warning non-blocking kalau akun yang dipilih historinya dominan berlawanan arah.

**Dicoba user langsung di `tauri dev`** (screenshot) — gagal di percobaan pertama: toggle dari Piutang→Utang, field "Akun Utang Piutang" TIDAK ikut berubah (tetap "Piutang"), warning tidak muncul. Lagi investigasi bug `useEffect`-nya saat user interupsi dengan pertanyaan fundamental: "apakah skema tabel saat ini sudah bisa handel utang piutang?"

Setelah didiskusikan: disadari pendekatan ini secara fundamental rapuh (heuristik histori, tidak menjamin apa pun untuk akun baru, gampang diabaikan user, DAN implementasinya sendiri langsung berbug). User lalu ingat `investment_accounts` (tabel detail 1:1 untuk sub-tipe investasi) dan tanya apakah pola yang sama bisa dipakai untuk debt — jawabannya YA, dan itu jadi arah baru.

### 6. Riset Worker/MCP — dikonfirmasi kena gap yang sama

User tanya eksplisit apakah Worker/MCP perlu masuk cakupan. Dicek langsung (bukan diasumsikan): `apps/worker` punya replika PENUH modul debts (termasuk `classify-account-pair.ts` sendiri). Fungsi `createDirectDebt` (`apps/worker/src/modules/debts/service.ts:543-565`) — dipanggil LANGSUNG dari tool MCP `create_debt_direct`, TANPA lewat desktop sama sekali — cuma validasi `accountType === 'debt'`, sama rentan persis. Risiko malah LEBIH TINGGI di jalur ini: yang memilih `accountId` adalah LLM yang menebak dari deskripsi tool ("Akun bertipe 'debt'", tidak menyebut arah), bukan manusia melihat UI terfilter.

**Kesimpulan: Worker + MCP wajib masuk cakupan fix**, bukan opsional — dua implementasi terpisah, memperbaiki satu tidak melindungi yang lain.

### 7. Dokumen plan ditulis

[apps/desktop/docs/todos/plan/debt-account-direction.md](../../../apps/desktop/docs/todos/plan/debt-account-direction.md) — rancangan lengkap:

- **Skema**: tabel baru `debt_accounts` (1:1 dengan `accounts`, pola PERSIS `investment_accounts`), kolom `direction` (`'receivable' | 'payable' | 'both'`). Tabel baru murni, tidak perlu teknik copy-and-rename.
- **Backfill data existing**: tabel perhitungan histori pemakaian riil tiap akun debt (Piutang→`receivable`, Piutang Dagang→`receivable`, Utang Dagang→`payable`, Keluarga/Orang Lain/Bisnis→`both`).
- **Form "Tambah Akun"**: field "Arah" muncul kondisional saat `account_type==='debt'`, pola sama `unit_label` untuk investment.
- **`new-debt-form.tsx`**: dropdown difilter LANGSUNG dari `direction` (bukan heuristik) — buang total pendekatan percobaan pertama.
- **`applyDebtTransaction`**: validasi keras WAJIB (bukan opsional) — tolak kombinasi `debt_type` vs `direction` bertentangan.
- **Port ke Worker**: `direction` di D1, validasi di `createDirectDebt` SEBELUM insert.
- **MCP**: update deskripsi tool `create_debt_direct` supaya LLM tahu constraint arah.
- **Cleanup 2 baris lama**: diserahkan ke user, manual lewat UI (bukan SQL langsung) — termasuk data riil kontak Kak Ipit.
- **Smoke test checklist** 3 bagian: Desktop (`tauri dev`), Worker (`wrangler dev` lokal), MCP — eksplisit "WAJIB keduanya".

## Status kode saat ini

- **BELUM ada implementasi skema baru** (`debt_accounts`, migrasi, form akun) — baru rancangan di dokumen plan.
- **Working tree PUNYA SISA kode dari percobaan pertama yang DIBUANG, BELUM di-revert**:
  - `apps/desktop/src/shared/debts/new-debt-form/new-debt-form.tsx` — modified, isi: hook histori + prefill "cerdas" + warning non-blocking yang TERBUKTI rapuh/berbug saat dicoba user. **Perlu di-revert ke versi asli (`git diff`/`git checkout` file ini) di awal sesi berikutnya**, SEBELUM mulai implementasi rancangan skema — supaya tidak ada 2 pendekatan bercampur di file yang sama.
  - `apps/desktop/src/shared/debts/use-debt-account-usage.ts` — file baru, bagian dari percobaan yang dibuang. Perlu dihapus (atau dipertimbangkan ulang relevansinya — kemungkinan tidak terpakai lagi kalau dropdown sudah difilter langsung dari `direction`).
- **File baru yang DIPERTAHANKAN** (bukan bagian percobaan yang dibuang):
  - `docs/dogfooding/2026-10-16-form-utang-piutang-dropdown-akun-debt-tidak-difilter-per-jenis.md`
  - `apps/desktop/docs/todos/plan/debt-account-direction.md`
- `tsc --noEmit` sempat bersih dan 248 test vitest lulus SAAT percobaan pertama selesai ditulis (sebelum diketahui rapuh) — belum di-recheck setelah revert/perubahan lanjutan apa pun.
- TIDAK ada commit sepanjang sesi ini — semua di working tree, termasuk dogfooding doc dan plan doc yang BELUM di-commit.

## Gap yang TERSISA untuk sesi berikutnya

1. **Revert dulu sisa percobaan pertama** (`new-debt-form.tsx`, hapus `use-debt-account-usage.ts`) sebelum mulai apa pun — jangan lanjutkan/perbaiki heuristik histori, itu sudah diputuskan dibuang.
2. **Implementasi migrasi skema desktop**: `CREATE TABLE debt_accounts` + backfill data existing sesuai tabel di dokumen plan — ingat **daftarkan migrasi baru di `migrations.rs`** (lihat memori proyek: migrasi SQL tidak otomatis ter-apply tanpa registrasi manual).
3. **Form "Tambah Akun"**: field "Arah" kondisional untuk `account_type==='debt'`.
4. **`new-debt-form.tsx` versi final**: filter dropdown langsung dari `direction`, bukan prefill heuristik.
5. **`applyDebtTransaction`**: validasi keras `direction` vs `debt_type`/arah transfer.
6. **Port skema + validasi ke Worker** (`apps/worker/src/modules/accounts/service.ts`, `debts/service.ts` `createDirectDebt`), update deskripsi tool MCP `create_debt_direct`.
7. **Cleanup 2 baris `debts` lama yang salah kategori** — USER yang akan lakukan manual lewat UI setelah fix selesai (`01a13e62-cf6d...` kontak Kak Ipit masih `ongoing`, `01a14492-eb7f...` data uji coba) — JANGAN dieksekusi lewat SQL langsung oleh agent.
8. **Smoke test manual lengkap** sesuai checklist di dokumen plan — desktop (`tauri dev`) DAN Worker (`wrangler dev` lokal), termasuk kasus yang sengaja dibuat bertentangan arah untuk verifikasi validasi reject bekerja.

## Catatan proses (feedback untuk sesi berikutnya)

- **User menguji sendiri perubahan UI di `tauri dev` secara mandiri** (bukan minta agent yang start/restart dev server) — pola ini terbukti berharga: percobaan pertama yang di atas kertas terlihat benar logic-nya ternyata gagal di percobaan pertama nyata (`useEffect` tidak ter-trigger seperti dugaan). **Pertahankan**: jangan asumsikan logic `useEffect`/state form benar hanya dari baca kode sendiri untuk perubahan UI reaktif — terutama kombinasi `useWatch`+`useEffect` yang saling bergantung, rawan meleset dari ekspektasi penulis.
- **User menginterupsi tepat saat agent sedang debug detail (`useEffect` logic)** untuk menanyakan pertanyaan lebih fundamental ("apakah skema ini sudah bisa handle utang piutang?") — pola bagus untuk diingat: kalau sebuah fix terasa rapuh/berulang kali meleset, berhenti dulu dari debug detail dan pertimbangkan apakah akar masalahnya lebih dalam (di sini: skema, bukan logic form) sebelum lanjut menambal.
- **Jangan buru-buru eksekusi cleanup data riil** — user eksplisit minta cleanup 2 baris lama (termasuk data kontak Kak Ipit) dilakukan SENDIRI lewat UI, bukan lewat SQL langsung oleh agent, meski agent yang menemukan baris-barisnya. Pola ini konsisten dengan feedback lama [[feedback_backfill_migration_verify_not_assume]] soal kehati-hatian data riil.
- **Pola "cek dulu apakah sudah ada preseden/pola serupa di codebase sebelum merancang dari nol"** terbukti sangat berharga — `investment_accounts` (tabel detail 1:1) adalah jawaban tepat begitu dicek, dan rencana `credit_accounts` di `account-type.md` mengonfirmasi ini memang pola arsitektur yang sudah direncanakan proyek ini, bukan solusi ad-hoc. Pertahankan kebiasaan ini untuk keputusan skema besar berikutnya.
- **User secara eksplisit menolak mengerjakan Worker/MCP "kalau tidak relevan"** — tapi begitu dicek dan terbukti relevan (gap identik, risiko lebih tinggi karena tanpa UI), langsung diterima masuk scope. Jangan asumsikan scope sempit/luas tanpa verifikasi kode — tanya baru cek, bukan menebak dari nama modul.
