# Konsep Transaksi di Aplikasi Ini

## Transaksi adalah satu-satunya jalur sah mengubah saldo

Saldo sebuah akun (`accounts.balance`) **bukan kolom yang tersimpan** — selalu dihitung ulang dari `accounts.initial_balance` ditambah agregasi `SUM` seluruh baris `transactions` yang menyentuh akun itu (lihat `use-accounts.ts`). Konsekuensinya satu hal yang tegas: **tidak ada cara lain mengubah saldo selain lewat tabel `transactions`**. Tidak ada `UPDATE accounts SET balance = ...` di mana pun di kodebase ini, dan sengaja tidak boleh ada.

Ini penting disadari karena beberapa fitur butuh "menyesuaikan" saldo untuk peristiwa yang **bukan** transaksi uang sehari-hari (lihat di bawah) — satu-satunya cara teknis melakukannya tetap dengan membuat baris `transactions` baru, apa pun alasan di baliknya.

## Dua jenis transaksi: representasi uang riil, dan transaksi penutup

Secara **makna**, transaksi di aplikasi ini terbagi dua:

- **Transaksi uang riil** — merepresentasikan uang yang benar-benar berpindah tangan secara fisik (tunai) atau digital (transfer bank, e-wallet) pada momen itu. Ini mayoritas kasus: beli makan, gajian, transfer antar akun, pencairan/pelunasan piutang lewat akun kas.
- **Transaksi penutup** — dibuat BUKAN karena ada uang yang baru saja berpindah, melainkan untuk **menyamakan saldo akun dengan kenyataan** yang sudah terjadi lewat cara lain (fisik hilang tanpa tercatat, piutang yang diikhlaskan, penyelesaian lewat barter). Secara akuntansi nilainya tetap riil — akun itu memang kehilangan/mendapat nilai — hanya *momen uang berpindah* yang tidak persis sama dengan *momen transaksi ini dicatat* (atau memang tidak pernah ada perpindahan fisik sama sekali).

**Yang TIDAK berubah di antara keduanya**: `transactions.type` tetap cuma `income`/`expense`/`transfer` — tidak ada, dan sengaja tidak dibuat, kategori transaksi "non-uang"/abstrak terpisah. Transaksi penutup tetap **berkaitan dengan uang** (mengubah saldo akun dengan cara yang sama seperti transaksi biasa), cuma beda di *kapan* dan *kenapa* uang itu dianggap berpindah — bukan beda jenis datanya sama sekali.

## Contoh nyata yang sudah ada

- **Koreksi Saldo** (`correctAccountBalance`) — saldo tercatat tidak cocok dengan uang fisik yang benar-benar dipegang. Selisihnya dicatat sebagai SATU transaksi `income`/`expense` penutup, ditulis langsung ke `transactions` (lihat [konsep-tipe-akun.md](konsep-tipe-akun.md), bagian "Koreksi saldo TIDAK menyentuh data turunan").
- **Piutang/utang "Dihapuskan"** (`written_off`, `shared/debts/use-write-off-debt.ts`) — piutang diikhlaskan, tidak akan ditagih lagi. Dicatat sebagai transaksi `expense` (receivable)/`income` (payable) LANGSUNG pada akun `debt` itu sendiri sebesar sisa piutang, supaya saldo akun debt ikut mengarah ke nol — konsisten dengan prinsip "diselesaikan = saldo ke nol" di [konsep-utang-piutang.md](konsep-utang-piutang.md).
- **Pelunasan tanpa uang** (`settlement_mode: 'non_cash'` di `shared/debts/pay-debt-form/use-pay-debt.ts`) — piutang diselesaikan lewat barter/pemutihan/saling-offset, bukan uang berpindah lewat akun kas. Pola transaksi penutupnya identik dengan write-off di atas.

## Kenapa prinsip ini sempat dilanggar, dan kenapa itu salah

Implementasi awal "Dihapuskan" dan "pelunasan tanpa uang" sempat HANYA mengubah status (`debts.status`) atau insert `debt_payments` dengan `transaction_id: NULL`, **tanpa membuat transaksi apa pun**. Logikanya waktu itu terasa masuk akal: "tidak ada uang yang berpindah, jadi tidak perlu transaksi". Tapi ini keliru — karena saldo akun **hanya** bisa berubah lewat `transactions` (lihat di atas), tidak membuat transaksi berarti saldo akun `debt` itu **tidak pernah** berkurang, walau status piutangnya sudah "selesai". Akibatnya saldo akun debt terus menumpuk setiap ada piutang yang diselesaikan dengan cara ini — bertentangan dengan `konsep-utang-piutang.md` yang eksplisit bilang penyelesaian (apa pun jenisnya, termasuk "Dihapuskan") harus membawa saldo ke nol.

Pelajarannya: "tidak ada uang yang berpindah saat ini" **tidak sama** dengan "tidak perlu transaksi". Begitu sebuah peristiwa mengubah nilai yang "dipegang" sebuah akun — apa pun alasannya — itu harus lewat transaksi penutup, bukan jalan pintas langsung ke kolom status/agregat lain.

## Implikasi untuk fitur baru

Setiap kali fitur baru perlu "menyesuaikan" nilai yang melekat ke sebuah akun — bukan cuma tipe Utang/Piutang, tapi tipe akun mana pun yang akan menyusul (Investasi dengan laba/rugi belum terealisasi, Dana Pihak Ketiga, dst, lihat [konsep-tipe-akun.md](konsep-tipe-akun.md)) — tanyakan dulu: **"apakah ini mengubah nilai yang 'dipegang' akun tersebut?"** Kalau ya, itu wajib direpresentasikan sebagai transaksi `income`/`expense`/`transfer` (penutup atau biasa), bukan `UPDATE` langsung ke kolom lain yang berpura-pura saldo akun ikut berubah otomatis — karena memang tidak akan ikut berubah.
