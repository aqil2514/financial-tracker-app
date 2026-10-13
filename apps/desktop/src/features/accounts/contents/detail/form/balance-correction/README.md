# Form koreksi saldo akun

Koreksi saldo akun dengan membuat 1 transaksi penyesuaian otomatis
sebesar selisih antara saldo berjalan sekarang dan saldo yang seharusnya
diinput user — bukan mengubah `initial_balance` secara langsung, supaya
riwayat transaksi tetap konsisten dengan kontrak
`balance = initial_balance + akumulasi transaksi`.

## `hooks/use-correct-account-balance.ts`

- `now()` — format ISO lokal `"YYYY-MM-DDTHH:MM"` (sama seperti
  `use-create-transaction.ts`), BUKAN `datetime('now')` SQLite yang
  menghasilkan `"YYYY-MM-DD HH:MM:SS"` (pakai spasi, bukan `"T"`) — perlu
  literal `"T"` karena `formatDate()` mendeteksi ada-tidaknya waktu lewat
  cek itu pada string date.
- `getOrCreateCorrectionCategoryId` — kategori `"Penyesuaian Saldo"`
  dibuat sekali per tipe (`income`/`expense`) saat pertama kali dipakai,
  supaya transaksi koreksi tetap punya kategori untuk difilter/dilaporkan
  tanpa perlu setup manual dulu.

## `hooks/use-balance-correction-form.ts`

Wrapper tipis di atas `useCorrectAccountBalance` — bukan form state
sendiri (tidak ada `useForm` di sini). Pembuatan `form` + auto-reset saat
dialog dibuka ulang jadi tanggung jawab `AccountBalanceCorrectionForm`
(`components/index.tsx`) lewat `BaseForm`, sama seperti pola
`form/add-edit/`.
