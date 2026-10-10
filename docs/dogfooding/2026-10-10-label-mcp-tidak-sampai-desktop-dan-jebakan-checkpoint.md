# Label dari MCP tidak pernah sampai ke desktop, dan checkpoint yang terlanjur maju membuat perbaikannya tidak cukup dengan deploy

Ditemukan saat memakai laporan Cashflow per Label yang baru dibuat. 39 transaksi Oktober sudah diberi label lewat MCP dan terlihat benar di D1, tapi laporan di desktop tetap menunjukkan "Tanpa Label" 94%. Setelah akar masalahnya diperbaiki dan Worker di-deploy, laporan MASIH 94% — ada masalah kedua yang menumpang di belakang yang pertama.

## Bagaimana ketahuan

Kronologi (waktu WIB, 10 Okt 2026):

1. Laporan Cashflow per Label selesai dibuat dan diverifikasi benar terhadap data simulasi.
2. Dicek ke D1: `transaction_labels` = 39, `labels` = 7 — label yang dibuat lewat MCP memang ada.
3. Dibuka di desktop: laporan menunjukkan Tanpa Label 94%, cuma "Konsumtif" Rp 179.820 yang muncul.
4. Dicek `finance.db` lokal: `transaction_labels` = **1**, `labels` = **3**. Datanya memang tidak ada di lokal, bukan sekadar belum ter-render.
5. Worker diperbaiki + deploy, desktop di-build ulang, app dibuka — laporan **tetap** 94%.
6. Dicek lagi `finance.db`: masih 3/1. Pull jalan (checkpoint maju ke `06:09:24`) tapi tidak membawa label apa pun.

## Root cause

### 1. Tabel label tidak pernah ikut di jalur pull, di KEDUA sisi

Arah desktop → D1 sudah jalan lewat `pushOnWrite` (terbukti: 39 baris itu sampai ke D1). Arah D1 → desktop tidak ada sama sekali untuk label:

- `apps/worker/src/modules/sync/service.ts` mengirim 10 tabel di `/sync` (`account_groups`, `categories`, `contacts`, `accounts`, `transactions`, `debts`, `debt_payments`, `investment_*`) — tidak ada satu pun tabel label.
- `apps/desktop/src/shared/cloud-sync/pull-sync.ts` hanya menerapkan 7 tabel, juga tanpa label.

Jadi menekan "Sync" berapa kali pun tidak akan menarik label, karena Worker tidak pernah mengirimkannya. Checklist di `apps/desktop/docs/todos/done/general-label.md` menandai sync `[x]` — yang benar-benar selesai saat itu adalah push dan endpoint CRUD-nya; jalur pull terlewat tanpa disadari.

### 2. Junction label tidak bisa di-upsert `ON CONFLICT(id)` seperti tabel lain

Ini bukan bug yang terjadi, tapi jebakan yang hampir masuk saat menulis perbaikannya. Baris junction diidentifikasi oleh `UNIQUE(entity_id, label_id)`, BUKAN oleh `id`. Pola `applyRow` yang dipakai 7 tabel lain mencari baris lokal lewat `id` — kalau dipakai apa adanya untuk junction, baris dengan pasangan sama tapi `id` berbeda (mis. dibuat offline di desktop, lalu pasangan yang sama datang dari MCP dengan `id` lain) tidak terlihat sebagai konflik, dan INSERT-nya pecah `UNIQUE constraint failed` — kelas bug yang sama persis dengan yang diperbaiki pagi harinya di `apply-*-labels.ts` (lihat [writeup-nya](2026-10-10-label-akun-bentrok-unique-setelah-double-click.md)).

### 3. Checkpoint yang terlanjur maju: pull dengan kode LAMA "memakan" jendela waktunya

Ini yang membuat perbaikan di atas tidak langsung terasa, dan paling layak diingat.

Pull bersifat inkremental: desktop mengirim `?since=<checkpoint>` dan Worker hanya membalas baris dengan `updated_at > since`. Urutan kejadiannya:

| Waktu | Kejadian |
| --- | --- |
| 04:41 – 05:36 | label dibuat lewat MCP, `updated_at` baris-barisnya di rentang ini |
| ~06:09 | app dibuka dengan kode LAMA (belum tahu field label) → pull jalan, abaikan label, **checkpoint maju ke 06:09:24** |
| 12:45 | Worker di-deploy dengan label di `/sync` |
| 13:07 | desktop di-build ulang |
| setelah itu | app dibuka → kirim `?since=06:09:24` → Worker balas **kosong** |

Label berubah pada 05:36, lebih awal dari checkpoint 06:09. Dari sudut pandang Worker baris-baris itu "sudah pernah dikirim", padahal yang menerimanya saat itu adalah kode yang membuangnya. Dikonfirmasi dengan `curl /sync?since=2026-10-10 06:09:24` — responsnya benar-benar kosong di semua tabel.

Jadi deploy + build saja TIDAK cukup. Perlu memundurkan checkpoint supaya Worker mau mengirim ulang.

## Perbaikan

### Worker

Empat tabel (`labels`, `transaction_labels`, `category_labels`, `account_labels`) ditambahkan ke tipe `SyncResponse`, query `Promise.all`, dan mapping respons di `getSyncSnapshot`. Dideploy sbg version `afe30b76`; diverifikasi lewat `curl /sync` yang kini membalas `labels = 7`, `transactionLabels = 39`, `accountLabels = 4`.

### Desktop

`labels` (dictionary) diterapkan DULU sebelum ketiga junction-nya (FK `label_id`), dan junction setelah `transactions`/`categories`/`accounts` yang direferensikan FK-nya.

Junction TIDAK memakai `applyRow` generik, melainkan `applyLabelJunctionRow` yang mencari, meng-upsert, dan menghapus berdasarkan PASANGAN `(entity_id, label_id)` — bukan `id` — dengan `ON CONFLICT(entity_id, label_id)`. `id` lokal sengaja tidak ikut di-update saat konflik, supaya baris yang terlanjur dirujuk antrian push lokal tidak berubah identitas di tengah jalan.

Diverifikasi terhadap salinan `finance.db` nyata, bukan cuma typecheck:

| Uji | Hasil |
| --- | --- |
| Pull pertama (3/1 → 7/39) | tanpa error constraint |
| Pasangan sama, `id` lokal berbeda | tetap 39 baris (bukan 40), `id` lokal dipertahankan |
| Pull ulang | 0 baris diterapkan — idempoten |
| Detach dari sisi lain | kena meski `id` lokal beda |
| `integrity_check` / `foreign_key_check` | ok / bersih |

### Data

Checkpoint dimundurkan ke `NULL` (artinya full snapshot — `pullSync` menghilangkan `?since` saat null):

```sql
UPDATE settings SET value = NULL WHERE key = 'cloud_sync_last_checkpoint';
```

Aman karena `applySyncResponse` idempoten dan LWW `wins()` melindungi baris lokal yang lebih baru dari ditimpa data lama; konsekuensinya cuma transfer lebih besar (~2,3 MB). Setelah app dibuka, lokal jadi 7/39/4 dan laporan menampilkan Kebutuhan 50% / Produktif 29% / Konsumtif 11% / Tanpa Label 11%, berjumlah pas dengan total Pengeluaran.

`cloud_sync_attachments_checkpoint` sengaja TIDAK ikut direset — lampiran punya jalur dan checkpoint terpisah, me-resetnya hanya memicu unduh ulang tanpa guna.

## Catatan untuk ke depan

**Menambah tabel ke jalur sync butuh 3 langkah, bukan 2.** Deploy Worker dan build desktop saja meninggalkan lubang untuk semua baris yang `updated_at`-nya lebih lama dari checkpoint saat ini. Langkah ketiga: mundurkan `cloud_sync_last_checkpoint` (ke `NULL` untuk full snapshot, atau ke waktu sebelum baris paling lama yang perlu ditarik). Gejalanya menyesatkan — sync "sukses", checkpoint maju, tidak ada error di mana pun, datanya tetap tidak muncul.

**Cara cepat memastikan ini penyebabnya:** `curl` ke `/sync?since=<checkpoint saat ini>` dengan token sungguhan. Kalau responsnya kosong padahal data ada di D1, berarti jendela waktunya memang sudah lewat — bukan masalah kode.

**Push jalan tidak berarti pull jalan.** Keduanya jalur terpisah dengan daftar tabel masing-masing. Fitur yang "sudah disync" perlu dibuktikan dua arah, bukan cuma dari baris yang berhasil mendarat di D1.
