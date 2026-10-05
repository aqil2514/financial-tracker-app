# Verifikasi fix debts duplikat di production — 3 gap baru ditemukan

Lanjutan dari
[2026-10-05-debts-duplikat-desktop-vs-worker.md](2026-10-05-debts-duplikat-desktop-vs-worker.md):
fix source-based ownership (lihat
[`docs/todos/plan/fix-debts-duplikasi-sync.md`](../todos/plan/fix-debts-duplikasi-sync.md))
diimplementasikan, di-deploy, lalu diverifikasi langsung di production
(`wrangler dev` dulu, lalu desktop production build + Worker production
sungguhan) — **dari dogfooding langsung** (hapus 3 transaksi duplikat
lama, input ulang lewat UI, amati hasilnya di D1).

## Hasil verifikasi fix utama: BERHASIL

3 transaksi transfer cash→debt (Mama Dicky Rp188.871, Kak Ipit
Rp196.243, Wahyu Rp124.537) dihapus total dari `finance.db` lokal +
D1 production (dicek dulu tidak ada `debt_payments` terkait, aman
dihapus), lalu diinput ulang via UI desktop production build. Hasil
akhir, dicek lewat `wrangler d1 execute --remote` langsung (bukan
cuma toast UI):

- Mama Dicky: create baru → **1 baris** `debts` di D1, `id` sama
  persis dgn lokal, `sync_source: pc`.
- Kak Ipit: create baru → 1 baris `debts`. Edit note (field TIDAK
  berbahaya) → push `transactions` sukses, baris `debts` TETAP 1
  (tidak ikut berubah, sesuai ekspektasi `checkDebtEditAllowed`).
- Wahyu: create baru → 1 baris `debts`. Edit amount (field
  BERBAHAYA, dari Rp12.312 jadi Rp124.537 nilai final) → baris LAMA
  `deleted_at` terisi (soft-deleted via endpoint baru
  `DELETE /debts/push/:id`), baris BARU aktif — net 1 baris aktif,
  BUKTI jalur recreate (`applyDebtTransactionEdit` → delete lokal →
  `pushDeleteOnWrite`) bekerja benar sampai ke D1 production.

Satu gap desain ditemukan DI TENGAH proses verifikasi ini (bukan dari
rencana awal): endpoint push `/debts/push` cuma upsert-by-id, TIDAK
pernah tahu kalau desktop men-DELETE baris lama saat recreate —
ditutup dgn endpoint `DELETE /debts/push/:id` baru (detail lengkap di
dokumen Worker, sudah dicatat sbg bagian dari fix, bukan gap terpisah
di sini).

## Gap #1 (baru, TERPISAH dari fix debts): `resolveContactId` tidak push kontak baru

**Gejala**: transaksi Wahyu yang baru diinput GAGAL ter-push ke D1
production berkali-kali (`POST /transactions` dianggap "selesai" tapi
baris tidak pernah muncul di D1) — walau `/debts/push` sendiri sudah
benar (500 FK error-nya cuma GEJALA, bukan akar masalah: FK gagal
krn `transaction_id` rujukannya memang tidak pernah berhasil masuk
D1 duluan).

**Root cause**: kontak "Wahyu" (dibuat lewat `resolveContactId` di
form transaksi,
[`resolve-contact.ts`](../../apps/desktop/src/shared/contacts/resolve-contact.ts))
**TIDAK PERNAH ter-push ke Worker** — fungsi ini cuma INSERT lokal:

```ts
export async function resolveContactId(name: string | null): Promise<string | null> {
  // ...
  const id = newId();
  await db.execute("INSERT INTO contacts (id, name) VALUES ($1, $2)", [id, trimmed]);
  return id;
}
```

Tidak ada `pushOnWrite("contacts", id)` di sini. Akibatnya: transaksi
yang merujuk kontak ini SELALU ditolak Worker (422 "Kontak belum
ditemukan di cloud") via `validateResolvedContactExists`
(`transactions/service.ts`). Dan karena 422 (`rejected`) **tidak
pernah masuk antrian retry** (`push-on-write.ts`, keputusan desain
sadar — "data lokal valid menurut desktop sendiri, payload yang sama
akan ditolak lagi tanpa ada yang berubah"), transaksi ini **tidak
akan PERNAH pulih otomatis** — butuh trigger submit manual (edit lalu
Simpan) SETELAH dependency-nya (di sini: kontak) diperbaiki.

Workaround sesi ini: kontak "Wahyu" di-INSERT manual ke D1 production
lewat `wrangler d1 execute`, baru transaksi bisa di-submit ulang dan
berhasil.

**Efek berantai ke gap #2**: karena kontak lokal tidak pernah
ter-push, Worker (saat terima transaksi dgn `contactName` dari jalur
lain — kemungkinan MCP) auto-create VERSI KEDUA kontak "Wahyu" dgn
`id` berbeda (via `resolveContactId` versi Worker,
`contacts/service.ts`). Hasilnya 2 baris kontak nama identik di
database — lihat gap #2.

## Gap #2 (baru, TERPISAH): combobox kontak render salah saat ada 2 nama sama

**Gejala**: dropdown "Nama Kontak" di form Edit Transaksi menampilkan
"Wahyu" BERULANG-ULANG (2-3x, jumlahnya tidak konsisten antar
pembukaan dialog) walau database cuma punya 2 baris kontak nama itu.
Field juga sempat ter-clear sendiri saat dialog pertama kali dibuka
(kemungkinan efek samping render yang sama).

**Root cause**:
[`contact-field.tsx`](../../apps/desktop/src/features/transactions/form/add-edit/fields/contact-field.tsx)
me-map `contacts` jadi `options` pakai `contact.name` sbg `value`
(BUKAN `contact.id`):

```ts
const options: ContactOption[] =
  contacts?.map((contact) => ({ value: contact.name, label: contact.name })) ?? [];
```

Dan `ComboboxItem` (`combobox.tsx`) tidak pass `key` eksplisit beda
dari `item.value` yang di-derive dari situ — 2 kontak dgn `name` sama
(gap #1) berarti 2 `item` dgn `value` IDENTIK, React key collision
klasik, render-nya jadi tidak stabil/dobel tergantung timing.

**Workaround sesi ini**: kontak "Wahyu" versi kedua (hasil auto-create
Worker, TIDAK dipakai transaksi/debt manapun — dicek dulu via query
`WHERE contact_id = ...` ke kedua tabel sebelum hapus) dihapus dari
`finance.db` lokal + D1 production. Setelah dedup, combobox kembali
normal (1 "Wahyu" saja).

## Gap #3 (bukan bug baru, tapi pola berbahaya yang baru ketahuan efeknya): 422 rejected final, tidak pernah retry

Bukan temuan kode baru (`push-on-write.ts` sudah lama begini,
keputusan sadar) — tapi sesi ini pertama kali kelihatan DAMPAK
nyatanya: begitu satu push `transactions`/`debts`/entity apa pun
kena 422 (dependency belum sinkron, bukan network error), baris itu
**selamanya** tidak akan pulih kecuali ADA aksi user lain yang
memicu `pushOnWrite` ulang (edit & simpan). Tidak ada UI yang
menandai "baris ini gagal sync, perlu di-retry manual" — user tidak
akan tahu transaksinya tidak pernah sampai ke cloud kecuali
dicek manual ke database seperti sesi ini.

## Yang BELUM dilakukan (sengaja, di luar scope sesi ini)

- Gap #1 (`resolveContactId` tidak push) BELUM diperbaiki di kode —
  cuma di-workaround manual utk kasus Wahyu. Kontak lain yang dibuat
  lewat jalur sama berpotensi kena masalah serupa kalau belum pernah
  dipakai transaksi yang di-push (gap-nya baru kelihatan begitu ada
  transaksi yang mencoba memakainya).
- Gap #2 (combobox key collision) BELUM diperbaiki — `ContactField`
  masih pakai `name` sbg key. Berpotensi berulang kalau ada kontak
  nama sama lain muncul lagi (mis. dari sumber Retailku/MCP yang
  belum tahu kontak lokal sudah ada).
- Gap #3 (422 final, tanpa indikator UI) BELUM ada solusi dirancang
  — perlu didiskusikan: retry 422 setelah interval tertentu? Badge
  UI "gagal sync"? Di luar scope sesi ini sepenuhnya.

## Pelajaran

- Fix yang BENAR secara logic (source-based ownership utk `debts`)
  bisa tetap "macet" kalau dependency hulu-nya (di sini: kontak)
  punya gap sync sendiri yang tidak terlihat sampai dicoba dipakai —
  verifikasi end-to-end via dogfooding sungguhan (bukan cuma
  `wrangler dev` simulasi) penting justru karena mengungkap gap DI
  LUAR scope fix yang sedang dikerjakan.
- "422 tidak di-retry" masuk akal sbg keputusan desain (hindari retry
  sia-sia utk data yang memang invalid) TAPI asumsinya meleset kalau
  422-nya disebabkan STATE SEMENTARA (dependency belum sinkron) bukan
  data yang benar-benar salah — keduanya sulit dibedakan dari sisi
  client tanpa parsing alasan reject secara spesifik.
- 2 entity dgn `name` sama persis adalah kondisi yang HARUS
  diasumsikan bisa terjadi (apalagi kalau ada >1 sumber penulis:
  PC, MCP, Retailku) — kode UI yang pakai `name` sbg identitas unik
  (key React, dedup, matching) selalu rawan kalau asumsi "nama itu
  unik" ternyata tidak dijamin di level database.
