# Pola dialog: trigger vs dialog, satu state gabungan

## Aturan

Komponen yang MEMICU dialog (tombol "Tambah...", item action menu, dst)
dan komponen DIALOG itu sendiri (modal, form, konfirmasi) adalah dua hal
yang terpisah — jangan digabung jadi satu komponen seperti
`SomethingFormDialog` yang isinya sekaligus tombol trigger dan `<Dialog>`.

Pemisahannya:

1. **Trigger** — tombol/menu item, hidup di mana pun dia relevan secara
   UI (`header/`, item list, action menu, dst). Tidak tahu apa pun soal
   isi dialog — cuma memanggil `openDialog(type, dataId?)` dari context.
2. **Dialog** — komponen `<Dialog>` sungguhan (state open/closed, form,
   mutation). Hidup di `dialog/` milik fitur itu. Dirender **sekali** di
   level orkestrator fitur (`index.tsx` / `content/index.tsx`, bukan
   per-item), `open`-nya dikontrol dari context.
3. **State "dialog mana yang aktif"** — satu context per fitur, isinya
   pakai `useDialogState<TType>()` dari `hooks/use-dialog-state.ts`.

## `useDialogState`

```typescript
import { useDialogState } from "@/hooks/use-dialog-state";

type TransactionDialogType = "create" | "edit" | "delete-confirm";

const { dialog, openDialog, closeDialog, isOpen } =
  useDialogState<TransactionDialogType>();
```

Dipakai langsung kalau context dialog fiturnya sudah digabung ke context
lain yang lebih besar. Untuk kasus umum (context dialog berdiri sendiri),
pakai `createDialogContext` di bawah — dia sudah membungkus
`useDialogState` beserta `createContext`/`useContext`/guard error-nya.

State-nya SATU object gabungan, bukan beberapa `useState` terpisah:

```typescript
{ type: "edit", dataId: "42" } | { type: "create" } | null
```

- `dataId` (string), BUKAN objek data penuh — dialog fetch/derive datanya
  sendiri dari `dataId` (lewat query yang sudah ada), supaya datanya
  selalu segar, bukan snapshot basi dari saat tombol diklik.
- Hanya bisa ada satu dialog aktif dalam satu waktu — konsekuensi
  langsung dari satu state tunggal, bukan aturan terpisah yang perlu
  dijaga manual.
- `null` = tidak ada dialog terbuka.

## `createDialogContext` — factory Provider+useDialog

```tsx
// features/transactions/dialog/context.tsx
import { createDialogContext } from "@/hooks/create-dialog-context";

type TransactionDialogType = "create" | "edit" | "delete-confirm";

const { DialogProvider, useDialog } = createDialogContext<TransactionDialogType>();

export { DialogProvider as TransactionsDialogProvider };
export { useDialog as useTransactionsDialog };
```

Tiap fitur panggil `createDialogContext<TType>()` sekali, lalu re-export
dengan nama fiturnya sendiri — tidak perlu menulis ulang
`createContext`/`useContext`/guard error tiap kali, tapi tetap dapat
nama export yang spesifik per fitur (bukan nama generic yang sama untuk
semua fitur).

## Taruh di context fitur, render sekali di orkestrator

```tsx
// features/transactions/dialog/index.tsx
export function TransactionsDialogs() {
  const { dialog, closeDialog } = useTransactionsDialog();

  return (
    <>
      <TransactionFormDialog
        open={dialog?.type === "create"}
        onOpenChange={(open) => !open && closeDialog()}
      />
      <TransactionEditDialog
        dataId={dialog?.type === "edit" ? dialog.dataId : undefined}
        open={dialog?.type === "edit"}
        onOpenChange={(open) => !open && closeDialog()}
      />
    </>
  );
}
```

Trigger di `header/` atau `content/` tinggal:

```tsx
<Button onClick={() => openDialog("create")}>Tambah Transaksi</Button>
```

atau, untuk trigger yang butuh data spesifik (mis. tombol edit di baris
tabel):

```tsx
<Button onClick={() => openDialog("edit", transaction.id)}>Edit</Button>
```

## Kenapa bukan beberapa `useState` terpisah

Pola lama (mis. `activeAccount` + `activeDialog` sebagai dua `useState`
berbeda) tetap bisa dibuat konsisten kalau selalu di-set bersamaan lewat
satu fungsi (`openDialog(account, dialog)`), tapi tetap dua sumber
kebenaran yang harus dijaga manual agar tidak sync. `useDialogState`
menghilangkan kelas bug ini karena cuma ada satu `useState`.

## Relasi dengan `page-layout.md`

Sejalan dengan pembagian header/content/footer/**dialog** — dialog
adalah bagian struktural sendiri (`dialog/` sebagai folder sibling dari
`header/`/`content/`), bukan sesuatu yang menumpang di komponen bagian
lain. Kalau ada komponen yang menggabungkan trigger dan dialog jadi satu
(seperti `TransactionFormDialog` lama yang dipasang langsung sebagai
`actions` header), itu tanda dialog belum dipisah sesuai pola ini.
