# Cakupan form transaksi utama: semua tipe akun, atau khusus kas

## Status & TODO saat ini (ringkas)

Belum ada keputusan. Dokumen ini hanya mencatat bahan diskusi, belum ada kode yang diubah. Detail ada di bagian "Latar belakang" dan "Opsi" di bawah.

- [x] Pertanyaan dicatat (2026-11-07), muncul saat merancang tipe akun Valas.
- [x] Valas sudah diputuskan memakai dialog khusus, guard di form transaksi utama dipertahankan, lihat [account-type-forex.md](../../../apps/desktop/docs/todos/plan/account-type-forex.md).
- [ ] Diskusi: tetap satu form untuk semua tipe, atau form utama khusus kas.
- [ ] Kalau memilih khusus kas: tentukan perilaku Edit dan Hapus transaksi tipe khusus dari daftar transaksi.
- [ ] Kalau memilih khusus kas: rencana migrasi untuk utang/piutang, investasi, dan dana pihak ketiga di desktop.
- [ ] Putuskan, lalu tulis hasilnya di `docs/concept/konsep-transaksi.md`.

## Latar belakang

Desktop dan mobile saat ini berbeda arah:

- **Desktop** menyatukan semua jalur ke form transaksi utama (Okt 2026), termasuk pembelian direct dan write-off investasi, serta transfer ke akun utang. Alasan dan riwayat bug ada di [unify-direct-writeoff-into-main-transaction-form.md](../../../apps/desktop/docs/todos/done/unify-direct-writeoff-into-main-transaction-form.md).
- **Mobile** memilih layar khusus saja untuk investasi dan dana pihak ketiga (3-4 Nov 2026). Akun tipe itu disembunyikan permanen dari picker form transaksi. Alasannya: form utama selalu menyisipkan satu baris `transactions`, yang bertabrakan dengan aturan seperti "jual pending tidak boleh membuat transaksi".

Hal yang memicu pertanyaan ini di desktop:

- Tiap tipe akun baru menyentuh banyak file. Literal `'investment'` muncul di sekitar 36 file desktop.
- `tsc` tidak memperingatkan saat tipe baru ditambah. Router transfer (`createTransferTransaction`/`updateTransferTransaction`) jatuh diam-diam ke transfer kas biasa untuk pasangan yang tidak dikenal.
- Dokumen unify mencatat bug nyata dari dogfooding: ganti pasangan akun lintas domain meninggalkan baris yatim, edit transaksi direct menghapus baris pembelian, settlement FIFO gagal senyap.

Belum diukur seberapa sering bug berasal dari penyatuan dibanding sebab lain. Buktinya baru bug yang tercatat, jadi ini penilaian, bukan angka.

## Opsi

**A. Tetap satu form untuk semua tipe (kondisi desktop sekarang)**

- Untung: satu tempat melihat dan memperbaiki transaksi apa pun, misalnya koreksi nominal pembelian dari daftar transaksi. Jalur yang ada sudah teruji runtime.
- Rugi: tiap tipe baru menambah cabang di form dan router, dan tipe yang terlewat jatuh senyap jadi transfer kas.

**B. Form utama khusus kas, tipe lain lewat dialog atau layar khusus**

- Untung: invarian tiap tipe dijaga di tempatnya sendiri, tipe baru tidak menyentuh form utama, sejalan dengan mobile.
- Rugi: refactor besar untuk tiga domain yang sudah jadi di desktop. Koreksi transaksi tipe khusus pindah dari daftar transaksi ke layar tipe itu. Hapus transaksi tetap butuh logic cascade ke tabel turunan.
- Bentuk yang terpikir: daftar transaksi tetap menampilkan semua tipe untuk pelaporan, Edit transaksi tipe khusus diarahkan ke layar tipe itu.

**C. Campuran: tipe yang sudah ada tetap di form utama, tipe baru (mulai valas) khusus dialog**

- Untung: tidak ada refactor besar sekarang, tipe baru tidak memperbesar masalah.
- Rugi: dua pola hidup berdampingan di desktop, aturannya harus jelas supaya tidak membingungkan.

Posisi sementara: valas mengikuti opsi C. Keputusan untuk tiga domain yang sudah ada ditunda sampai ada bahan dari dogfooding.

## Pertanyaan terbuka

- Kalau bug dogfooding terkait tipe khusus masih muncul di form utama, apakah itu cukup jadi pemicu opsi B?
- Apakah ada kebutuhan nyata mengedit transaksi tipe khusus dari daftar transaksi, atau selama ini lewat layar tipenya?
- Kalau opsi B: apakah mobile dan desktop sebaiknya identik, termasuk menyembunyikan akun tipe khusus dari picker?
