# Cara memverifikasi data langsung di database dev (bukan cuma percaya UI)

## Aturan

Kalau ada perubahan yang MENULIS data (migrasi baru, fitur sync, mutation
baru) — jangan berhenti di `tsc`/`npm test`/`npm run build` atau screenshot
UI yang "kelihatannya berhasil". Toast sukses di UI cuma membuktikan mutation
React Query tidak melempar error — itu TIDAK sama dengan membuktikan baris
yang benar, dengan nilai yang benar, benar-benar tersimpan di tabel yang
benar. Verifikasi dengan query SQL langsung ke salinan database dev.

**Lokasi database** (Windows, aplikasi ini):
```
C:\Users\<user>\AppData\Roaming\com.windows.financial-app\finance.dev.db   (tauri dev)
C:\Users\<user>\AppData\Roaming\com.windows.financial-app\finance.db      (build/installer production)
```
Dipilih otomatis oleh `NODE_ENV` di `lib/db.ts` — `tauri dev` SELALU pakai
`finance.dev.db`, build/installer SELALU pakai `finance.db`. Baca
`lib/db.ts` untuk detail, JANGAN asumsikan dari nama file semata.

## Kenapa

- Bug nyata pernah lolos dari `tsc`/`test`/`build` karena ketiganya tidak
  menyentuh Tauri/SQLite sungguhan sama sekali — `error returned from
  database: (code: 5) database is locked` (dari BEGIN/COMMIT manual yang
  tidak didukung `@tauri-apps/plugin-sql`) baru ketahuan saat tombol
  sungguhan diklik di `tauri dev`, bukan dari verifikasi statis.
- Toast/UI state React Query bisa "berhasil" secara teknis (mutation
  resolve tanpa throw) padahal secara LOGIKA data yang tersimpan salah —
  mis. field ke-swap, transaksi ganda karena idempotency check keliru,
  atau (kasus nyata) toast hijau yang terlihat ternyata dari mutation LAIN
  (field "Titik Awal Sync" disimpan), bukan dari tombol yang sedang diuji
  ("Sync Sekarang") — keduanya sama-sama menampilkan toast hijau, mudah
  tertukar kalau dipercaya dari screenshot saja.

## Cara melakukannya

1. **JANGAN pernah query file database aktif secara langsung** — app yang
   sedang berjalan mungkin masih menulis ke sana. Selalu `cp` ke scratchpad
   dulu:
   ```bash
   cp "/c/Users/<user>/AppData/Roaming/com.windows.financial-app/finance.dev.db" \
      "<scratchpad>/finance.dev.db.check"
   ```

2. **WAJIB ikut sertakan file `-wal` (dan `-shm` kalau ada) dalam SATU
   copy yang sama** — SQLite di mode WAL (default `@tauri-apps/plugin-sql`)
   menyimpan transaksi TERBARU di file `.db-wal` terpisah, BELUM
   di-checkpoint ke file `.db` utama. Meng-copy `.db` saja bisa membaca versi
   BASI (kejadian nyata: `.db` utama menunjukkan "belum ada data sync sama
   sekali" padahal sync SUDAH berhasil — datanya ada di `.db-wal` yang
   belum ikut ter-copy):
   ```bash
   cp ".../finance.dev.db"     "<scratchpad>/check.db"
   cp ".../finance.dev.db-wal" "<scratchpad>/check.db-wal"
   cp ".../finance.dev.db-shm" "<scratchpad>/check.db-shm" 2>/dev/null
   sqlite3 "<scratchpad>/check.db" "SELECT ...;"   # otomatis baca -wal juga
   ```
   Cara mengenali file mana yang benar-benar aktif kalau ragu: bandingkan
   `LastWriteTime` (PowerShell `Get-Item ... | Select LastWriteTime`) —
   file dengan WAL yang baru saja berubah itu yang sedang dipakai proses
   yang hidup, BUKAN selalu file `.db` dengan timestamp terbaru (`.db`
   utama cuma ter-update saat checkpoint terjadi, bisa jauh lebih lama).

3. **Cek migrasi benar-benar jalan** sebelum menyimpulkan apa pun soal
   skema baru — jangan asumsikan dari "migrasi sudah didaftarkan di
   `migrations.rs`":
   ```bash
   sqlite3 -column check.db \
     "SELECT version, description, success FROM _sqlx_migrations ORDER BY version DESC LIMIT 5;"
   ```
   Migrasi Tauri SQL plugin jalan SEKALI saat aplikasi start — menambah
   migrasi baru ke kode TIDAK membuatnya otomatis ter-apply ke instance
   `tauri dev` yang sedang berjalan; perlu restart app.

4. **Query langsung isi tabel yang relevan**, jangan cukup `COUNT(*)` atau
   `.tables` — lihat nilai aktualnya untuk mencocokkan dengan ekspektasi
   (mis. `source_ref` benar formatnya, `account_id` mengarah ke akun yang
   benar, `contact_id` terisi, dst):
   ```bash
   sqlite3 -header -column check.db "SELECT ... FROM transactions WHERE source='retailku_sync' ORDER BY id DESC LIMIT 20;"
   ```

5. **Ikuti relasi FK untuk verifikasi efek samping**, bukan cuma tabel yang
   langsung ditulis — mis. verifikasi `debts` yang lahir dari
   `applyDebtTransaction()` dengan JOIN balik ke `transactions`/`contacts`,
   bukan cuma percaya baris `transactions`-nya sendiri sudah benar:
   ```sql
   SELECT d.id, d.type, d.amount, c.name, d.transaction_id, d.status
   FROM debts d LEFT JOIN contacts c ON c.id = d.contact_id
   WHERE d.transaction_id IN (SELECT id FROM transactions WHERE source='retailku_sync');
   ```

## Kapan TIDAK perlu selengkap ini

- Fitur READ-ONLY murni (menampilkan data MCP/API eksternal apa adanya,
  tanpa menulis apa pun ke SQLite lokal) — `tsc`/`test`/`build` bersih
  sudah cukup, karena tidak ada state database untuk salah.
- Perubahan UI/styling yang tidak menyentuh query atau mutation sama
  sekali.
- Query `SELECT` eksploratif cepat untuk sekadar mengecek satu nilai yang
  sudah pasti aman dibaca (mis. cek isi tabel referensi yang tidak
  berubah) — overhead `cp` WAL+SHM tetap dianjurkan sebagai kebiasaan
  default, tapi tidak fatal kalau dilewati untuk pengecekan yang sifatnya
  sekali pakai dan low-stakes.
