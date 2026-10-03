# Titik Rawan Lintas-Tipe-Akun — Tindak Lanjut

> Status: #1 sudah solid sejak awal, #2 dan #3 SUDAH DI-FIX sesi
> 2026-10-04 (lihat di bawah). Lanjutan dari
> [audit-kepatuhan-konsep-tipe-akun.md](audit-kepatuhan-konsep-tipe-akun.md)
> (2026-10-03) — sebagian besar temuan di dokumen itu SUDAH di-fix di
> commit `572ff59` ("Fix kode yang menyimpang dengan konsep tipe akun"),
> termasuk guard tipe terkunci, `accountId` wajib, `debts`
> controller/router di Worker, dan `classifyAccountPair` eksplisit
> (desktop + Worker). Dokumen audit lama itu SEBAGIAN SUDAH USANG —
> jangan dibaca sebagai "masih semua terbuka".
>
> Dokumen ini ditulis sesi 2026-10-03 lanjutan, setelah verifikasi ulang
> kode terkini (bukan dari dokumen audit lama) menemukan titik rawan
> yang BELUM tersentuh fix sebelumnya.

## Ringkasan

| # | Titik | Lokasi | Status |
|---|---|---|---|
| 1 | Transfer transaksi | `classify-account-pair.ts` (desktop + worker) | Solid — sudah di-fix, fail-safe (throw utk kombinasi tak dikenal) |
| 2 | Koreksi saldo | `correctAccountBalance` (`accounts/service.ts`) + tool MCP `correct_account_balance` | **Selesai (2026-10-04)** — ditolak total utk tipe akun terlarang |
| 3 | Larangan income/expense langsung ke tipe tertentu | `violatesDebtAccountRule` (`transactions/service.ts`) | **Selesai (2026-10-04)** — pakai helper terpusat, tidak hardcoded lagi |

Titik #1 dicatat di sini sebagai pembanding/referensi pola yang BENAR
(fail-safe, eksplisit per kombinasi, throw kalau belum dikenal) — bukan
untuk ditindaklanjuti lagi, sudah selesai.

---

## 2. Koreksi saldo — bypass total terhadap data turunan

> **FIX (2026-10-04):** `correctAccountBalance` sekarang cek tipe akun
> SEBELUM hitung diff/insert apa pun — kalau `account_type` termasuk
> `isAccountTypeRestrictedFromDirectTransaction` (helper baru di
> `shared/account-types.ts`, saat ini isinya `["debt"]`), langsung
> `return { status: "rejected", reason: ... }`. Controller
> (`accounts/controller.ts`) balas 422 dgn pesan alasan. Tool MCP
> `correct_account_balance` otomatis ikut kebagian (proxy langsung ke
> endpoint Worker, tidak ada logic sendiri).
>
> Keputusan: TOLAK TOTAL, bukan izinkan+warning — karena saldo akun
> bertipe `debt` derived dari tabel `debts`/`debt_payments`, bukan nilai
> bebas. Koreksi yg valid lewat: (1) transaksi transfer manual
> (otomatis sinkron ke `debts` via `applyDebtTransaction`), atau (2)
> perbaiki transaksi akar penyebabnya. Kasus nyata kemarin (data hasil
> import dari aplikasi lain, tidak kompatibel dgn skema `debts` di sini)
> tetap valid ditangani manual via `wrangler d1 execute` — itu data
> repair utk data migrasi, bukan pola yg akan berulang dari transaksi
> yang dihasilkan sistem ini sendiri, jadi TIDAK dibuatkan jalur
> API/tool resmi. Kalau nanti ternyata ada kebutuhan koreksi berulang
> utk transaksi yang memang dibuat sistem ini, itu sinyal utk desain
> fitur khusus — bukan buka lagi jalur generik ini.

**File:** `apps/worker/src/modules/accounts/service.ts` (`correctAccountBalance`),
dipanggil dari tool MCP `correct_account_balance`
(`apps/mcp-server/src/app/api/mcp/route.ts:400-418`) dan dari UI desktop
(`apps/desktop/src/features/accounts/dialogs/balance-correction-dialog/`).

### Masalah

`correctAccountBalance` menghitung selisih saldo target vs saldo saat
ini, lalu INSERT **langsung** satu baris `transactions` (`income`/
`expense`) ke D1 — **tidak lewat** `createTransactionRow`/
`insertTransaction` (jalur normal). Akibatnya logic turunan yang
biasanya ikut terpicu dari sebuah transaksi SELALU dilewati, apa pun
tipe akunnya:

- `applyDebtTransaction` (bikin/mutakhirkan baris `debts` dari transfer
  cash↔debt) — TIDAK terpicu. Koreksi saldo akun bertipe Utang/Piutang
  mengubah saldo akun tanpa menyentuh satu pun baris `debts` — saldo
  akun dan rincian "siapa berutang berapa" (dipakai `get_debt_summary`,
  Ringkasan Kontak) jadi tidak saling menjelaskan.
- `violatesDebtAccountRule` (lihat temuan #3 di bawah) — otomatis
  dilewati juga, karena jalur ini SELALU tulis `income`/`expense`
  langsung tanpa lewat validasi itu.

**Ditemukan nyata** (bukan hipotesis) sesi 2026-10-03: setelah koreksi
saldo akun "Keluarga"/"Orang Lain" (debt) ke 0 lewat tool ini, saldo
akun berubah tapi tabel `debts` tidak ikut — harus ditambal manual
lewat `wrangler d1 execute` langsung ke D1 (INSERT manual ke `debts`/
`debt_payments` dengan ID yang di-copy dari SQLite lokal), BUKAN lewat
mekanisme aplikasi normal mana pun.

### Kenapa ini beda dari titik #1

Titik #1 (transfer) sudah fail-safe: `classifyAccountPair` throw
`UnsupportedAccountPairError` untuk kombinasi tipe yang belum dikenal
— developer TIDAK BISA lupa menanganinya, aplikasi akan error keras.
Koreksi saldo justru sebaliknya: fail-silent, berhasil "ok" untuk tipe
akun apa pun tanpa peduli ada data turunan yang seharusnya ikut
disesuaikan atau tidak. Tidak ada sinyal error/peringatan apa pun —
deskripsi tool MCP (`correct_account_balance`) juga tidak menyebut
keterbatasan ini sama sekali.

### Pertanyaan utk sesi solusi

1. Koreksi saldo pada akun bertipe Utang/Piutang: ditolak total (minta
   user koreksi lewat mekanisme lain — misal transaksi transfer
   manual), atau tetap diizinkan tapi dengan peringatan eksplisit di
   response/UI bahwa data turunan tidak ikut disesuaikan?
2. Kalau tetap diizinkan: apakah `correctAccountBalance` perlu versi
   khusus per tipe akun (mirip `classifyAccountPair`), atau cukup
   dokumentasi + disiplin manual (seperti sesi ini)?
3. Pola yang sama akan terulang untuk tipe akun turunan lain nanti
   (Investasi dengan riwayat beli/jual, dst) — apakah solusi utk
   Utang/Piutang ini perlu didesain supaya generik (bukan tambal
   khusus `debt` lagi)?

---

## 3. Larangan income/expense langsung ke tipe tertentu — hardcoded, fail-silent

> **FIX (2026-10-04):** `violatesDebtAccountRule` sekarang panggil
> `isAccountTypeRestrictedFromDirectTransaction` (helper baru,
> `shared/account-types.ts`) alih-alih `=== "debt"` hardcoded. Daftar
> tipe terlarang jadi satu sumber kebenaran, dipakai di SINI dan di
> `correctAccountBalance` (temuan #2) sekaligus — nambah tipe akun baru
> yg butuh aturan serupa (mis. "investment") = tambah ke 1 array di
> `account-types.ts`, otomatis kena di kedua jalur tanpa perlu diingat
> manual.
>
> Sentralisasi dgn desktop (`use-transaction-form.ts`) BELUM dilakukan —
> masih 2 implementasi terpisah (Worker reject keras, desktop
> auto-correct di form). Diputuskan cukup Worker-side dulu krn itu
> penjaga akhir semua jalur tulis (PC, MCP) — desktop cuma UX
> convenience, bukan satu-satunya garda.

**File:** `apps/worker/src/modules/transactions/service.ts:46-60`
(`violatesDebtAccountRule`).

### Masalah

```ts
async function violatesDebtAccountRule(env, payload) {
  if (payload.type === "transfer") return false;
  if (!payload.accountId) return false;
  const row = await env.DB.prepare(
    "SELECT account_type FROM accounts WHERE id = ?1 AND deleted_at IS NULL"
  ).bind(payload.accountId).first();
  return row?.account_type === "debt"; // <- hardcoded ke 'debt' saja
}
```

Aturan "income/expense tidak boleh langsung menyentuh akun ini, wajib
lewat transfer" kemungkinan BUKAN cuma relevan untuk tipe Utang/Piutang
— `audit-kepatuhan-konsep-tipe-akun.md` (temuan #2) sudah pernah
menyinggung tipe Investasi idealnya juga butuh aturan serupa (tidak
boleh kena income/expense tanpa representasi transaksi pasar).

Beda dari `classifyAccountPair` (titik #1) yang THROW untuk kombinasi
tak dikenal, fungsi ini DIAM-DIAM `return false` (lolos validasi) untuk
tipe akun apa pun selain `"debt"` — tidak ada sinyal "tipe ini belum
dipertimbangkan di sini". Begitu tipe baru ditambahkan dan ternyata
butuh aturan serupa, celah ini tidak akan ketahuan dari error, cuma
dari pengamatan manual.

### Pertanyaan utk sesi solusi

1. Apakah larangan ini seharusnya didaftar eksplisit per tipe
   (whitelist/blacklist terpusat, bukan `=== "debt"` tunggal), supaya
   nambah tipe baru ke daftar itu jadi keputusan sadar, bukan celah
   senyap?
2. Validasi serupa ada juga di desktop (`use-transaction-form.ts`,
   auto-correct type jadi transfer) — apakah perlu disentralisasi
   bareng, atau cukup Worker-side karena itu penjaga akhir semua jalur
   tulis (PC, MCP)?

---

## Tidak termasuk temuan baru (sudah dicek, aman)

Supaya tidak diaudit ulang sia-sia sesi berikutnya — titik-titik ini
SUDAH diverifikasi terhadap kode terkini dan TIDAK rawan:

- Filter dropdown Retailku (6 lokasi, `account_type === "cash"` /
  `"debt"` terpisah eksplisit, bukan `!== "debt"` sbg proxy cash) —
  akun tipe baru otomatis tidak muncul di opsi mana pun (tersembunyi,
  bukan salah diklasifikasi).
- `use-transaction-debt-fields.ts` — sudah pakai `classifyAccountPair`
  utk validasi form, bukan asumsi biner terpisah.
- `createDirectDebt` (`debts/service.ts:486`, cek `accountType !==
  "debt"`) — intrinsik ke fitur piutang/utang langsung, bukan asumsi
  generik yang salah utk tipe lain.
- Laporan/dashboard (`TotalBalanceCard`, pie chart grup akun) — jumlah
  semua akun apa adanya, tidak ada filter tipe tersembunyi.
- Definisi `AccountType` sudah tersentralisasi di
  `apps/desktop/src/lib/account-types.ts` (dan padanannya di
  worker/mcp-server) sejak fix `572ff59`.
