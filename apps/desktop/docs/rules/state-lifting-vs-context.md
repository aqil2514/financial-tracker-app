# Kapan state harus diangkat ke context, bukan diteruskan lewat props

## Aturan

Kalau sebuah komponen (biasanya `page.tsx` atau komponen "orchestrator" lain)
menyimpan sebuah state HANYA untuk diteruskan ke satu atau lebih children
(bukan dipakai langsung olehnya sendiri untuk merender sesuatu), state itu
sebaiknya diangkat ke context yang scope-nya sesuai — bukan disimpan sebagai
`useState` lokal di komponen tersebut lalu di-drilling lewat props.

Ciri paling gampang untuk mendeteksi kasus ini: komponen itu punya state/handler
yang muncul di JSX-nya hanya sebagai prop ke children, tidak pernah dibaca
langsung untuk logic atau render di badan komponen itu sendiri. Kalau begitu,
komponen itu cuma jadi "pipa" — dan pipa yang bisa dihindari.

## Kenapa

- Komponen yang cuma jadi pipa ikut kena rewrite kalau kontrak data antara
  children berubah (nama prop, bentuk value), padahal dia sendiri tidak
  peduli pada data itu.
- JSX yang bersih dari data plumbing jadi bisa dibaca sebagai deskripsi
  LAYOUT semata — "halaman ini py punya header, terus ada grid dua kolom,
  isinya A dan B" — tanpa perlu menelusuri props apa yang mengalir ke mana.
- Kalau dua children yang perlu berbagi state itu SIBLING (bukan
  parent-child), context menghindari kebutuhan "mengangkat state ke parent
  cuma supaya bisa diteruskan turun lagi ke sibling lain".

## Kapan TIDAK berlaku (props tetap benar)

- **Komponen leaf/reusable yang sengaja didesain controlled** (menerima
  `value`/`onChange` lewat props) supaya bisa dipakai berulang dengan data
  berbeda-beda, atau dipakai TANPA provider tertentu. Lihat aturan
  "controlled component" di `apps/desktop/src/components/filters/README.md`
  — `FilterText`/`FilterSelect`/`FilterNumber` sengaja tidak membaca context
  supaya suatu saat bisa dipakai berdiri sendiri tanpa `FilterPanel`.
- **State yang benar-benar dipakai sendiri oleh parent**, bukan cuma
  diteruskan mentah — kalau parent melakukan logic dengan state itu
  (transformasi, kondisi render, dsb) sebelum meneruskannya, itu bukan
  sekadar pipa.
- **State lokal murni milik satu komponen**, yang tidak pernah dibagi ke
  komponen lain — tetap `useState` biasa, tidak perlu context (contoh:
  `month` di kalender kalender bulan yang sedang ditampilkan, sebelum jadi
  `TransactionCalendarPanel` — itu tidak dibagi kemana pun, jadi tetap state
  lokal, bukan context).
- Jangan buat context "untuk jaga-jaga" kalau saat ini cuma dipakai satu
  komponen dan tidak ada rencana nyata untuk dibagi. Ikuti kebutuhan yang
  ada, bukan spekulasi.
- **Data per-elemen dari hasil `.map()` atas sebuah list** tetap diteruskan
  sebagai props biasa ke komponen item (mis. `<TransactionListItem tx={tx} />`
  di `list/list-card-content.tsx`). Ini bukan "state yang di-drill" — tiap
  elemen memang datanya beda-beda per pemanggilan, bukan satu nilai yang
  dibagi banyak consumer. Context tetap dipakai di DALAM komponen item itu
  untuk data lain yang memang dibagi (mis. `accountName`/`categoryName`/
  `deleteTransaction` di `TransactionListItem` diambil dari `useList()`,
  bukan diteruskan lewat props dari pemanggil `.map()`).

## Contoh nyata di proyek ini

**Sebelum** (`app/(app)/transactions/page.tsx` versi lama): `page.tsx`
menyimpan `selectedDate` sebagai `useState` lokal, lalu meneruskannya sebagai
prop `dateFilter` (sudah diformat) ke `TransactionList`, dan
`selectedDate`/`onSelectedDateChange` ke `TransactionCalendarPanel`. Kedua
child itu SIBLING — `page.tsx` sendiri tidak pernah memakai `selectedDate`
untuk apa pun selain meneruskannya. Ini pipa murni.

**Sesudah**: dibuat `TransactionsPageProvider` +
`useTransactionsPage()` di
`features/transactions/page/transactions-page-context.tsx`, membungkus
`selectedDate`, `setSelectedDate`, dan `dateFilter` turunannya.
`TransactionList` dan `TransactionCalendarPanel` masing-masing memanggil
`useTransactionsPage()` sendiri, tidak menerima props terkait tanggal sama
sekali. `page.tsx` sekarang murni layout:

```tsx
<TransactionsPageProvider>
  <PageContainer maxWidth="6xl">
    <PageHeader title="Transaksi" ... />
    <div className="grid ...">
      <TransactionList />
      <TransactionCalendarPanel />
    </div>
  </PageContainer>
</TransactionsPageProvider>
```

## Menentukan scope context

Jangan langsung bikin satu context raksasa untuk seluruh page. Pisahkan per
level tanggung jawab — mirip prinsip di
`apps/desktop/src/components/filters/README.md` soal `FilterKeyOption` vs
`FilterConfig`, tapi di sini soal batas antar context:

- Context di level **page** (mis. `TransactionsPageProvider`) untuk state
  yang dibagi antar section-section besar di halaman itu (list vs kalender).
- Context terpisah di level **sub-bagian** (mis. `ListProvider` di
  `list/list-context.tsx` untuk `page`/`limit`/`filters`/data hasil query
  internal `TransactionList`, dan `CalendarProvider` di
  `calendar/calendar-context.tsx` untuk `month`/data hari internal
  `TransactionCalendarPanel`) untuk state yang cuma relevan di dalam satu
  section itu sendiri, supaya section lain tidak ikut ter-subscribe ke
  perubahan yang tidak relevan buat mereka.

Setiap context baru taruh sebagai `<nama>-context.tsx` sejajar dengan
komponen yang menjadi "pemilik" scope-nya (lihat
`features/transactions/page/transactions-page-context.tsx`), dengan pola
`createContext` + `useContext` + guard error ("must be used within Provider")
seperti provider filter (`components/filters/panel/provider.tsx`) dan pola
`createResourceContext` di referensi `retail-multitenant`.

## Pola pemecahan orchestrator + sub-view

Begitu sebuah context sudah ada untuk suatu section, orchestrator section itu
(`TransactionList`, `TransactionCalendarPanel`, dst) sebaiknya jadi murni
komposisi — tidak ada logic maupun akses data langsung di situ, cuma
menyusun Provider + sub-komponen:

```tsx
// list/transaction-list.tsx
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

Tiap sub-view (`ListCardHeader`, `ListCardContent`, `ListCardFooter`,
`CalendarCardHeader`, `CalendarCardContent`, dst) memanggil hook context-nya
sendiri (`useList()`, `useCalendar()`) untuk BAGIAN data yang dia pakai saja
— tidak menerima apa pun dari orchestrator lewat props. Pemecahan per bagian
visual `Card` (`CardHeader` vs `CardContent` vs `CardFooter`) adalah batas
yang wajar untuk sub-view semacam ini, bukan aturan kaku — pecah sesuai
tanggung jawab visual yang jelas, jangan dipaksakan kalau satu section
memang sederhana (lihat `CalendarSummaryHeader`/`DayButtonWithSummary` yang
dipecah lebih halus lagi dari `CalendarCardContent` karena masing-masing
punya tanggung jawab render yang berbeda).

Untuk pecahan yang lebih kecil dan HANYA dipakai satu file (tidak perlu
dipanggil dari file lain), tidak perlu file terpisah — cukup beberapa
komponen `const ... = (...) => {...}` (arrow function) sejajar di file yang
sama. Contoh: `TransactionListItem` di `list/transaction-list-item.tsx`
dipecah jadi `TransactionListItem` (orchestrator baris), `ItemInfo`
(icon+akun+badge+tanggal+catatan), `ItemActions` (jumlah+edit+hapus) — semua
di satu file karena ketiganya cuma relevan sebagai bagian dari satu baris
item, tidak ada gunanya dipanggil dari tempat lain.
