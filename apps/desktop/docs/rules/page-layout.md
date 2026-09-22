# Struktur halaman: header, content, footer, dialog, page, form

## Aturan

Sebelum membangun halaman baru (atau merombak halaman yang sudah ada),
bicarakan dulu pembagiannya ke bagian-bagian berikut — bagian mana saja
yang relevan, sebelum menulis kode. Empat yang pertama menjawab "apa
yang ditampilkan"; `page/` dan `form/` (dibahas belakangan di dokumen
ini) menjawab "apa yang dibagi antar bagian tampilan itu", dan cuma
muncul kalau kebutuhan berbagi itu benar-benar terjadi:

1. **Header** — judul halaman/section, deskripsi singkat, dan slot aksi utama
   (tombol "Tambah...", toggle, dsb). Wajib ada di level halaman
   (`PageHeader`); boleh juga muncul lagi di level section kalau section itu
   sendiri butuh judul+aksi sendiri (mis. "Per Kontak" di atas grid card).
2. **Content** — badan utama halaman: tabel, grid card, chart, form, apa pun
   yang jadi alasan halaman itu ada. Selalu ada.
3. **Footer** (opsional) — elemen di bagian bawah yang terpisah dari
   content, mis. pagination, ringkasan total, action bar. Tidak semua
   halaman/section butuh ini.
4. **Dialog** (opsional) — modal/dialog yang dipicu dari halaman ini (form
   tambah, form edit, konfirmasi hapus, dst). Tidak semua halaman/section
   butuh ini. Pola internalnya (pemisahan trigger vs dialog, state "dialog
   mana yang aktif") ada di `dialog-pattern.md`.

Diskusikan bagian-bagian ini secara eksplisit dulu — jangan langsung
menulis kode lalu menyusun ulang belakangan begitu terasa berantakan.

**Contoh konkret — halaman Dashboard** (`features/dashboard/`):

- **Header**: `DashboardHeader` (`header/index.tsx`) — membungkus
  `PageHeader` dengan judul "Dashboard" + deskripsi "Ringkasan kondisi
  keuangan Anda", tidak ada aksi (tidak ada tombol di slot `actions`).
- **Content**: `DashboardContent` (`content/index.tsx`) — SEMUA card di
  bawahnya: "Total Saldo", "Bulan Ini", chart "Tren 6 Bulan Terakhir", dan
  list "Transaksi Terbaru". Semuanya masuk content, walau ada 4 card
  berbeda — bukan berarti tiap card otomatis jadi bagian layout tersendiri
  (lihat "Kapan TIDAK perlu dipecah lebih jauh" di bawah).
- **Footer**: tidak ada di halaman ini.
- **Dialog**: tidak ada di halaman ini.

`page.tsx`-nya:

```tsx
export default function DashboardPage() {
  return (
    <PageContainer>
      <DashboardHeader />
      <DashboardContent />
    </PageContainer>
  );
}
```

## `page.tsx` sebagai orkestrator

`page.tsx` TIDAK BOLEH berisi state, query, atau logic apa pun — DAN tidak
menulis `PageHeader` (atau elemen JSX lain) langsung. Tugasnya murni
MENYUSUN komponen-komponen dari `features/<nama-fitur>/` jadi satu
tampilan, satu baris per bagian:

```tsx
export default function SomePage() {
  return (
    <PageContainer>
      <SomeFeatureHeader />
      <SomeFeatureContent />
      <SomeFeatureFooter />       {/* kalau ada */}
      <SomeFeatureDialogs />      {/* kalau ada */}
    </PageContainer>
  );
}
```

`SomeFeatureHeader` sendiri isinya cuma membungkus `PageHeader` dengan
title/description/actions yang sudah tetap (lihat contoh nyata
`features/dashboard/header/index.tsx`) — `PageHeader` TIDAK PERNAH
ditulis langsung di `page.tsx` dengan props inline. Ini bukan pengecualian
opsional, tapi konsekuensi langsung dari "page.tsx tidak boleh tahu detail
apa pun": string title/description ADALAH detail fitur itu, sama seperti
konten atau query-nya.

Kalau ada logic yang terasa perlu ditaruh di `page.tsx` (state, efek,
kondisi render berdasarkan data), itu tandanya logic itu harus turun ke
komponen feature yang relevan, bukan naik ke `page.tsx`.

## Struktur folder: SERAGAM di level top-level tiap fitur

Setiap `features/<nama-fitur>/` yang dipanggil langsung dari sebuah
`page.tsx` WAJIB punya struktur folder yang seragam — `header/` dan
`content/` selalu ada sebagai folder (bukan opsional strukturnya);
`footer/`, `dialog/`, `page/`, `form/`, `shared/` ditambahkan kalau fitur
itu memang punya bagian tersebut:

```
features/<nama-fitur>/
├── header/     — SomeFeatureHeader: bungkus PageHeader dengan
│                 title/description/actions milik fitur ini
├── content/    — SomeFeatureContent: badan utama (tabel, grid, widget, dst)
├── footer/     — kalau ada — pagination, ringkasan, action bar
├── dialog/     — kalau ada — modal/dialog terkait fitur ini
├── page/       — kalau ada — context yang dibagi lintas section di
│                 dalam content/ (lihat "Folder page/" di bawah)
├── form/       — kalau ada — schema/fields/hooks form yang dibagi
│                 lintas dialog (lihat "Folder form/" di bawah)
├── shared/     — kalau ada — hook/helper/konstanta murni yang dibagi
│                 lintas section/dialog (lihat "Folder shared/" di bawah)
└── index.ts    — barrel: re-export publik fitur ini (Header/Content/
                  Dialogs/dst), TIDAK berisi JSX ATAU logic. Orkestrasi
                  JSX sesungguhnya (susun Header+Content+Footer+Dialogs
                  jadi satu tampilan) terjadi di `app/.../page.tsx`,
                  bukan di sini — lihat "`page.tsx` sebagai orkestrator".
```

Keseragaman ini soal STRUKTUR FILE, bukan soal seberapa rumit isinya —
`header/index.tsx` untuk fitur sederhana isinya boleh cuma 3 baris
(bungkus `PageHeader` dengan 2 string statis), sama seperti
`content/index.tsx` boleh cuma memanggil satu komponen. Yang tidak boleh:
`PageHeader` ditulis langsung di `page.tsx`, atau content ditulis langsung
tanpa folder `content/` pembungkus — lihat "`page.tsx` sebagai orkestrator"
di atas untuk alasannya.

`footer/`/`dialog/`/`page/`/`form/`/`shared/` TETAP opsional secara
STRUKTUR (jangan buat folder kosong kalau fitur itu memang tidak punya
salah satunya) — bedanya dengan `header/`/`content/` yang selalu ada
karena setiap halaman pasti punya judul dan konten, sedangkan kelima
folder lainnya memang tidak selalu relevan.

## Kapan TIDAK perlu dipecah lebih jauh — level WIDGET DI DALAM content/

Aturan di atas soal struktur TOP-LEVEL fitur — beda dari soal apakah
sebuah WIDGET DI DALAM `content/` perlu dipecah lagi jadi
header/content/footer/dialog-nya sendiri. Widget kecil yang cuma
menampilkan satu hal sederhana (fetch data sendiri, tidak berbagi state,
tidak ada dialog) CUKUP satu file datar, TIDAK perlu dipecah lagi secara
internal.

Contoh: `content/total-balance/index.tsx` di Dashboard cukup satu file
berisi `Card`+`CardHeader`+`CardTitle`+`CardContent` langsung, karena
isinya cuma satu angka — tidak ada bagian lain untuk dipecah DI DALAM
widget itu sendiri. Tapi dia TETAP berada di dalam folder `content/`
fitur `dashboard` — bukan alasan untuk membuat `dashboard/` sendiri tidak
punya folder `content/` sama sekali.

Barulah kalau satu widget itu sendiri mulai punya beberapa bagian nyata
(mis. perlu dipecah jadi beberapa sub-tampilan, atau menambahkan dialog),
pecah SAAT itu terjadi — bukan disiapkan strukturnya lebih dulu sebelum
ada isi untuk mengisinya.

## Pola yang sama berulang di level SECTION — bukan cuma level fitur

Kebalikan dari widget kecil di atas: kalau sebuah section DI DALAM
`content/` sudah cukup besar (state/context sendiri, DAN sudah kelihatan
setidaknya 2 dari 3 bagian header/content/footer), section itu ikut
pola header/content/footer yang sama seperti level fitur — bukan cuma
level `features/<fitur>/`. Ini rekursi dari aturan yang sama, bukan
aturan baru.

Contoh nyata — `content/list/` di `features/transactions/` (isinya
`TransactionList`, ditampilkan sebagai satu `Card` di dalam
`TransactionsContent`):

```
content/list/
├── list-card-header.tsx    — ListCardHeader: judul "Daftar Transaksi" + filter/sort
├── list-card-content.tsx   — ListCardContent: badan tabel/list transaksi
├── list-card-footer.tsx    — ListCardFooter: pagination
├── list-context.tsx        — ListProvider/useList — context KHUSUS section ini
├── transaction-list-item.tsx
├── use-transactions.ts
└── index.tsx                — TransactionList: orkestrator section
```

`index.tsx`-nya:

```tsx
export function TransactionList() {
  return (
    <ListProvider>
      <Card>
        <ListCardHeader />
        <ListCardContent />
        <ListCardFooter />
      </Card>
    </ListProvider>
  );
}
```

Beda dengan level fitur (yang pakai folder eksplisit `header/`/`content/`/
`footer/`), section BOLEH tetap pakai konvensi PENAMAAN FILE datar
(`list-card-header.tsx`, bukan `header/index.tsx`) selama section itu
tidak sebesar/serumit fitur penuh — folder eksplisit per-bagian baru
perlu kalau salah satu bagiannya sendiri mulai punya banyak sub-file.
Yang WAJIB sama persis dengan level fitur:

- `index.tsx` section = orkestrator murni (susun header+content+footer,
  pasang provider-nya), TIDAK ada state/query/logic langsung di situ.
- Context yang dipakai section ini SENDIRI (bukan dibagi ke section lain)
  tinggal di section itu juga (`list-context.tsx`) — TIDAK naik ke `page/`
  fitur. `page/` cuma untuk context yang dibagi LINTAS SECTION (lihat
  "Folder `page/`" di bawah) — `dateFilter` dari `TransactionsPageProvider`
  dikonsumsi `list-context.tsx`, tapi state list itu sendiri
  (filter/sort/pagination) tetap lokal ke `list/`.

Section kecil yang cuma 1-2 bagian (mis. cuma content, tanpa
header/footer terpisah) TIDAK perlu dipaksa punya ketiganya — sama seperti
`footer/`/`dialog/` opsional di level fitur.

## Rekursi yang sama berlaku juga untuk `dialog/`

Bukan cuma section di `content/` — satu dialog INDIVIDUAL di `dialog/`
(mis. `transaction-detail-dialog.tsx`) juga boleh direkursi jadi folder
sendiri begitu dia sendiri mulai punya beberapa bagian nyata (mis. data-
fetching wrapper + presentational besar tercampur dalam 1 file, atau mulai
butuh sub-komponen sendiri) — kriterianya sama dengan section: bukan lagi
"satu hal sederhana", tapi sudah beberapa tanggung jawab berbeda dalam
satu file.

```
dialog/
├── transaction-create-dialog.tsx   — masih sederhana, tetap 1 file
├── transaction-edit-dialog.tsx     — masih sederhana, tetap 1 file
├── detail/                         — kalau transaction-detail-dialog.tsx
│   ├── index.tsx                     sudah cukup kompleks untuk direkursi
│   ├── content.tsx
│   └── use-transaction-detail.ts
└── transaction-delete-confirm-dialog.tsx
```

Jangan direkursi lebih dulu "untuk jaga-jaga" — sama seperti section,
pecah SAAT kompleksitasnya benar-benar terasa, bukan disiapkan strukturnya
sebelum ada isi yang butuh dipecah.

## Folder `shared/` — hook/helper/konstanta MURNI yang dipakai lintas bagian

Beda dari `form/` (isinya KOMPONEN form + schema + mutation hooks) dan
`page/` (isinya PROVIDER React context): `shared/` untuk hook/helper/
konstanta murni (bukan komponen React) yang dipakai berulang di lebih
dari satu bagian — bisa lintas section (`content/list/` dan
`content/calendar/`), lintas dialog (beberapa file di `dialog/`), atau
campuran section+dialog+`page/`.

Contoh nyata di `features/transactions/`:

- `useTransactionById` — query 1 transaksi by id, dipakai
  `dialog/transaction-edit-dialog.tsx`, `dialog/transaction-detail-dialog.tsx`,
  DAN `page/deep-link-edit-dialog.tsx`. Sebelum dipindah ke `shared/`, dia
  "menumpang" di `content/list/` padahal tidak dipakai section manapun,
  cuma numpang karena dulu ditulis berdekatan dengan `use-transactions.ts`.
- `typeConfig` (ikon/label/warna per tipe transaksi) — kalau ditemukan
  terduplikasi persis di `content/list/transaction-list-item.tsx` DAN
  `dialog/transaction-detail-dialog.tsx`, itu tandanya harus diekstrak ke
  `shared/`, bukan dibiarkan didefinisikan ulang di tiap tempat.

Tanda sesuatu HARUS pindah ke `shared/`: dipakai lebih dari satu bagian
(section/dialog/page berbeda) DAN bukan komponen React. Tanda TIDAK perlu
pindah: cuma dipakai SATU bagian — tetap tinggal di situ, jangan
dipindah "untuk jaga-jaga" duluan.

**Struktur folder `shared/` sendiri** — flat dulu (`shared/use-transaction-by-id.ts`
langsung), pecah per JENIS (bukan per section/dialog, karena `shared/`
sudah netral dari kepemilikan) begitu isinya beragam:

```
shared/
├── hooks/           — query/mutation hooks
├── utils/           — pure function (accountName, categoryName, dst)
└── constants.ts      — data statis (typeConfig, dst)
```

Sama seperti bagian lain: jangan siapkan `hooks/`/`utils/` sebelum ada
lebih dari satu file per jenis yang butuh dikelompokkan.

## State dan context ikut pembagian ini

Konsisten dengan `state-lifting-vs-context.md`: state yang dibagi antar
bagian-bagian ini (mis. dialog mana yang sedang aktif, dipakai oleh content
untuk memicu dan oleh dialog untuk merender) diangkat ke context milik
fitur itu — bukan diteruskan lewat props berjenjang dari `app/.../page.tsx`
turun ke tiap subfolder.

Kalau sebuah halaman menyusun BEBERAPA fitur sekaligus (lebih dari satu
`<SomeFeatureHeader />`/`<SomeFeatureContent />` dari fitur berbeda
dipanggil bersisian dari satu `app/.../page.tsx`) dan fitur-fitur itu
perlu berbagi state satu sama lain, barulah context itu naik ke level
`page.tsx` — tetap ikuti prinsip yang sama: state yang benar-benar dibagi
lintas fitur naik ke atas, state yang cuma dipakai satu fitur tetap
tinggal di context fitur itu sendiri.

## Folder `page/` — context yang dibagi LINTAS SECTION di dalam satu fitur

Beda dari kasus di atas (lintas FITUR, context naik ke `page.tsx`): kalau
state dibagi antar beberapa section DI DALAM `content/` fitur yang sama
(mis. `selectedDate`/`dateFilter` dipakai bersama oleh `content/list/` dan
`content/calendar/` di `features/transactions/`), context-nya tetap masuk
level fitur — tapi sebagai folder `page/` sendiri, sejajar dengan
`header/`/`content/`/`dialog/`, BUKAN didorong masuk ke salah satu
section di `content/`:

```
features/transactions/
├── header/
├── content/
│   ├── list/       — section 1, konsumsi dateFilter dari page/
│   └── calendar/    — section 2, konsumsi + set selectedDate dari page/
├── dialog/
└── page/           — TransactionsPageProvider/useTransactionsPage
```

Providernya dipasang di `page.tsx` (bukan di `content/index.tsx`), karena
dia harus membungkus semua consumer-nya — sama seperti pola provider
lain yang dijelaskan di atas, cuma di sini konsumennya adalah beberapa
section sekaligus dalam satu fitur, bukan seluruh fitur. Pola yang sama
dipakai `features/debts/page/`.

Nama foldernya `page/` (bukan `context/`) supaya konsisten dengan
kenyataan bahwa dia dipasang tepat di level `page.tsx` — bedakan dari
context yang dipakai HANYA satu section (mis. `content/list/list-context.tsx`),
yang cukup tinggal di dalam section itu sendiri, tidak perlu naik ke `page/`.

## Folder `form/` — schema+fields+hooks yang dibagi LINTAS DIALOG

Kasus serupa `page/`, tapi untuk sisi form: kalau schema/fields/hooks form
sebuah entity dipakai LEBIH DARI SATU dialog dalam fitur yang sama (mis.
`TransactionForm` dipakai baik `dialog/transaction-create-dialog.tsx`
maupun `dialog/transaction-edit-dialog.tsx`), form itu tidak boleh
"tinggal" di salah satu dialog lalu diimpor dialog lain — naikkan jadi
folder `form/` sendiri, sejajar dengan `header/`/`content/`/`dialog/`/`page/`:

```
features/transactions/
├── header/
├── content/
├── dialog/           — TransactionCreateDialog, TransactionEditDialog, dst
│                        (mengimpor TransactionForm dari ../form)
├── form/             — TransactionForm, transaction.schema.ts,
│                        use-create-transaction.ts, use-update-transaction.ts
└── page/
```

**Kalau ada lebih dari satu form/entity dalam satu fitur** (mis. fitur
yang punya form transaksi DAN form kategori cepat sekaligus), pecah per
entity DI DALAM `form/` — sama seperti `content/list/`, `content/calendar/`
memecah isi `content/` per section:

```
form/
├── transaction/      — TransactionForm, transaction.schema.ts, hooks
└── quick-category/    — QuickCategoryForm, quick-category.schema.ts, hooks
```

Kalau form suatu entity CUMA dipakai satu dialog (tidak dibagi), dia tetap
boleh tinggal langsung di dalam dialog itu sendiri (mis.
`dialog/some-confirm-dialog.tsx` yang formnya kecil dan tidak dipakai di
tempat lain) — folder `form/` di level fitur cuma perlu dibuat kalau
sudah ada kebutuhan berbagi nyata, bukan disiapkan lebih dulu untuk
jaga-jaga (sama seperti prinsip "Kapan TIDAK perlu dipecah" di atas).
