# Status migrasi

Folder ini sebelumnya berisi 5 dialog akun. 4 di antaranya (`form-dialog`, `detail-dialog`, `balance-correction-dialog`, `delete-dialog`) sudah dipindah ke [contents/detail/dialog/](../contents/detail/dialog/) sebagai bagian migrasi `page-layout.md` (lihat README di sana).

`edit-dialog/` (`AccountEditDialog`) SENGAJA tetap di sini — dipakai lintas fitur oleh `features/investment-detail/header/index.tsx` (uncontrolled, trigger sendiri), bukan cuma oleh halaman Akun. Komponen ini masih pakai form LAMA (`features/accounts/form/account-form.tsx` dkk — lihat `../form/README.md`).

`contents/detail/dialog/edit/` BUKAN lagi delegasi/reuse ke komponen ini — sejak form akun dimigrasi penuh ke `contents/detail/form/add-edit/` (pola `BaseForm`, native `Dialog`), dialog edit di tab Detail punya implementasi sendiri (`AccountForm`/`useUpdateAccount` dari lokasi baru), independen dari `AccountEditDialog` di sini. Keduanya sekarang 2 implementasi terpisah yang kebetulan melakukan hal yang sama, bukan satu sumber kebenaran yang di-share.

`features/investment-detail/` akan ikut di-refactor mengikuti pola `page-layout.md` setelah migrasi `features/accounts/` selesai penuh — saat itu, `AccountEditDialog` di sini kemungkinan diganti untuk ikut pakai form baru juga (dengan trigger/state uncontrolled-nya sendiri), lalu folder `edit-dialog/` ini dan seluruh `features/accounts/form/` lama baru bisa dihapus.
