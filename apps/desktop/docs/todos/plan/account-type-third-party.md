# Tipe Akun Dana Pihak Ketiga

## Status & TODO saat ini (ringkas)

Penjelasan lengkap kenapa tiap poin ada di sini — lihat model data & aturan lengkap di [docs/concept/konsep-dana-pihak-ketiga.md](../../../../../docs/concept/konsep-dana-pihak-ketiga.md), BACA DULU sebelum menulis kode apa pun di sini — dokumen ini cuma checklist teknis, bukan pengganti konsepnya.

- [x] Diskusi konsep selesai (2026-10-09) — model data, arah pergerakan yang valid/tidak valid, pengecualian cashflow, semua sudah diuji dari berbagai skenario nyata. Lihat dokumen konsep.
- [ ] Keputusan belum diambil: bentuk tabel detail (reuse pola `debts` apa adanya, atau disesuaikan — lihat "Belum diputuskan" di dokumen konsep).
- [ ] Keputusan belum diambil: perlu kolom `status` (lunas/berjalan) atau cukup dihitung ulang dari SUM transaksi.
- [ ] Keputusan belum diambil: validasi "ambil melebihi sisa titipan" — perlu atau tidak, pola seperti apa.
- [ ] Migrasi skema (`account_type` tambah `'third_party'`, tabel detail) belum ditulis.
- [ ] `classifyAccountPair` belum ditambah kombinasi `third_party-*` — PENTING: `third_party-third_party` BUKAN reuse dari `debt-debt` yang sudah ada (itu ternyata no-op, lihat dokumen konsep bagian "Pindah tempat dan/atau pindah kepemilikan") — perlu logic baru sungguhan.
- [ ] Logic `applyThirdPartyTransaction` (atau nama serupa) belum ditulis — PERHATIAN: pola utamanya `income`/`expense` SATU SISI (seperti investasi `record_mode: direct`), BUKAN trigger dari `transfer` seperti `applyDebtTransaction`. Transfer cuma relevan untuk `third_party → third_party`.
- [ ] Form titip/ambil (income/expense pada akun third_party) belum didesain.
- [ ] Form transfer `third_party → third_party` (pindah tempat/kepemilikan) belum didesain — butuh DUA field kontak independen (asal, tujuan), bukan satu kontak dipakai bersama.
- [ ] Pengecualian cashflow (`WHERE account_type != 'third_party'`) belum diimplementasikan — cek semua tempat yang query cashflow, bukan cuma `use-cashflow-summary.ts` (lihat daftar luas file yang menyinggung cashflow di `apps/desktop/src/features/reports/` dan `apps/desktop/src/features/retailku/`).
- [ ] Fitur turunan "siapa titip berapa di mana" (breakdown per kontak × akun) belum didesain.
- [ ] Penempatan UI/halaman belum diputuskan (halaman terpisah vs bagian dari halaman Akun).
- [ ] Badge/indikator di card akun halaman Akun (`AccountCard`, lihat [account-card.tsx](../../../src/features/accounts/sections/list/content/account-card.tsx)) — kemungkinan BESAR tidak perlu badge/breakdown tambahan karena saldo sudah terpisah bersih sejak dari struktur akun (beda dari dugaan awal diskusi yang sempat mengira titipan tercampur di akun cash biasa).
- [ ] Sinkronisasi ke `apps/worker`/`apps/mcp-server` — belum dibahas sama sekali.

## Latar belakang

Dipicu oleh kebutuhan nyata: user (Aqil) sudah menyimpan dana titipan orang lain, saat ini "terbantu" oleh fitur pisah kantong Bank Jago sebagai workaround manual — tapi di financial-app sendiri, akun yang dipakai ("Kantong Utama (Jago)") masih bertipe `cash` biasa, belum ada pemisahan terstruktur. Artinya total kekayaan pribadi di dashboard/laporan saat ini tercampur dengan saldo yang bukan benar-benar milik Aqil.

`docs/concept/konsep-tipe-akun.md` (ditulis lebih dulu) sudah menyebut "Dana Pihak Ketiga" sebagai salah satu tipe akun yang akan menyusul, dengan konteks awal dari kebutuhan sync Retailku (`CASH_OPNAME.thirdPartyFunds`) — tapi `CASH_OPNAME` dari Retailku sendiri sudah FINAL sebagai `generic` (dana titipan toko sengaja tidak pernah dijurnal Retailku, lihat `docs/reference/retailku-cashflow-row-classification.md`). Fitur ini di financial-app MURNI kebutuhan pencatatan pribadi, terpisah dari sync Retailku.

## Kenapa modelnya SEPERTI INI (ringkasan keputusan, detail di dokumen konsep)

Diskusi menguji dan MENOLAK beberapa alternatif sebelum sampai ke model final:

1. **DITOLAK: atribut/flag di transaksi akun `cash` yang sudah ada** (bukan akun terpisah) — melanggar prinsip "satu akun satu tipe murni" di `konsep-tipe-akun.md`, balik mencampur saldo titipan dengan saldo pribadi di akun yang sama.
2. **DITOLAK: satu akun virtual per kombinasi tempat×pihak** (mis. "Kas Tunai-Adel", "Bank Jago-Adel") — meledak jumlah akun tiap ada penitip baru, menyimpang dari pola `debt` yang justru tidak butuh akun per kontak.
3. **DITOLAK: satu akun global menampung semua titipan lintas tempat** — kehilangan breakdown per-tempat yang dikonfirmasi sebagai kebutuhan nyata ("titipan Adel di Kas Tunai berapa, di Bank Jago berapa").
4. **DIPILIH: satu akun virtual `third_party` PER TEMPAT FISIK** (grup/lokasi) — "Kas Orang Lain [Tunai]", "Kas Orang Lain [Bank Jago]", dst. Banyak pihak dibedakan via `contact_id` di level data DALAM satu akun, mirror persis pola `debt`/`contacts`.

Lalu diuji arah pergerakan mana yang valid sebagai `transfer` vs harus `income`/`expense` terpisah — hasilnya: `third_party ↔ cash` TIDAK PERNAH transfer (diuji lewat beberapa skenario: ambil+upah, hibah/pindah-kepemilikan-ke-Aqil — keduanya tetap dua transaksi independen, bukan satu transfer), sementara `third_party → third_party` (pindah tempat dan/atau pindah kepemilikan antar pihak) VALID sebagai transfer dengan kontak sisi keluar/masuk independen. Detail lengkap tiap skenario yang diuji ada di dokumen konsep, bagian "Tiga jenis pergerakan".

## Perbandingan dengan pola yang sudah ada (buat orientasi implementasi nanti)

| Aspek | `debt` (sudah ada) | `third_party` (rencana) |
|---|---|---|
| Trigger utama | `transfer` (cash↔debt) | `income`/`expense` SATU SISI (seperti investasi `record_mode: direct`) |
| Transfer antar akun sama tipe | `debt-debt` diklasifikasi tapi NO-OP (tidak diimplementasikan) | `third_party-third_party` HARUS diimplementasikan sungguhan (pindah tempat/kepemilikan) |
| Ambiguitas arah | `debt-cash` ambigu, butuh `debtAction` eksplisit dari user | Tidak ambigu — `income`=nitip, `expense`=ambil, jelas dari jenis transaksinya sendiri |
| Masuk cashflow? | Ya (transfer tidak masuk cashflow dari awal, tapi debt TIDAK py pengecualian khusus income/expense) | TIDAK — pengecualian baru berdasar `account_type`, preseden pertama di app ini |
| Satu akun per kontak? | Tidak — kontak dibedakan di `debts.contact_id` | Tidak — sama, kontak dibedakan di level data, bukan akun |

## Pekerjaan yang MASIH KOSONG (belum ada draf sama sekali)

Beda dari `account-type-investment.md` yang saat ditulis sudah py rencana pendekatan konkret dari awal, dokumen ini baru sampai tahap KONSEP matang — belum ada satu baris desain skema SQL, belum ada draf kode. Urutan kerja yang disarankan SEBELUM mulai coding:

1. Putuskan 3 pertanyaan terbuka di dokumen konsep (bentuk tabel detail, perlu status atau tidak, validasi oversell atau tidak) — ini akan menentukan bentuk migrasi.
2. Baru setelah itu: migrasi skema (`account_type` + tabel detail), `classifyAccountPair`, `applyThirdPartyTransaction`.
3. Form titip/ambil dan form transfer third_party→third_party.
4. Pengecualian cashflow — audit SEMUA tempat yang query cashflow (bukan cuma satu file) sebelum menganggap selesai.
5. Fitur turunan breakdown per kontak × akun.
6. UI/halaman, badge, dst.
7. Worker/MCP sync — baru dipikirkan setelah desktop solid, mengikuti preseden investasi yang sempat desktop-only dulu.
