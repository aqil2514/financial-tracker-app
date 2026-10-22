# pull-sync

Logic pull: terapkan `SyncResponse` dari Worker ke SQLite lokal (lihat `docs/todos/plan/mcp-server-cloud-mirror.md`, "Logic pull").

## LWW (Last-Write-Wins)

Per baris per tabel: LWW compare `updatedAt` masuk vs `updated_at` lokal (sama seperti `apps/worker/src/shared/lww.ts`) — menang kalau STRICT lebih baru, lihat `wins.ts`. Baris lokal diisi via trigger AFTER UPDATE + backfill `created_at` (migrasi 0028), jadi perbandingan ini valid.

## Hard delete, bukan soft delete

`deletedAt` terisi dari Worker -> HARD DELETE lokal (keputusan sadar, 2026-10-01): desktop TIDAK punya satupun query yang filter `deleted_at IS NULL`, jadi menyimpan soft-delete apa adanya akan membuat baris "hidup tapi tersembunyi setengah2" di semua list/laporan PC. Hard delete lokal konsisten dengan cara desktop sudah bekerja (row yang dihapus beneran hilang). Lihat `apply-row.ts`, `apply-investment-account-row.ts`, `apply-label-junction-row.ts`.

## Urutan penerapan (lihat `index.ts`)

MENGIKUTI dependency FK:

1. `account_groups` / `categories` / `contacts` dulu (independen)
2. `accounts` (referensi `account_groups`)
3. `transactions` (referensi accounts/categories/contacts)
4. `debts` lalu `debt_payments`
5. 3 tabel investment (`investment_accounts`, `investment_purchases`, `investment_sales`) — SETELAH `accounts` + `transactions` di atas, karena FK `account_id`/`transaction_id` menunjuk ke sana
6. `labels` (dictionary) WAJIB sebelum ketiga junction-nya (FK `label_id`); junction sendiri setelah `transactions`/`categories`/`accounts` yang juga direferensikan FK-nya

## `hasLocalSourceRefConflict`

true kalau `(source, source_ref)` baris incoming SUDAH dipakai baris lokal lain (id beda) — unique index `idx_*_source_ref` akan menolak upsert-nya dan menggagalkan SELURUH pull. Kasus nyata: Retailku sync jalan di 2 PC, baris yang sama punya id beda tapi `source_ref` sama. Baris lokal dipertahankan, incoming dilewati (bukan dobel).

## `upsertDebt` / `upsertDebtPayment`

`debts`/`debt_payments` di D1 DITURUNKAN Worker sendiri dari transaksi (`applyDebtTransaction`), belum ada jalur push provenance-nya — jadi `'manual'` dari Worker belum tentu benar. Cabang UPDATE hanya menimpa `source`/`source_ref` kalau incoming `'retailku_sync'`; jejak Retailku lokal tidak boleh dihapus oleh `'manual'` default dari cloud.

## `upsertInvestmentAccount` / `applyInvestmentAccountRow`

`investment_accounts` ber-PK `account_id` (BUKAN `id`) — tidak bisa lewat `apply-row.ts` yang mengasumsikan kolom `id`, jadi LWW + hard-delete lokalnya ditangani `applyInvestmentAccountRow` secara terpisah (query manual by `account_id`).

## `upsertInvestmentSale`

`average_cost_per_unit`/`realized_pl` disalin APA ADANYA dari D1 (sama pola `debts`/`debt_payments` — desktop percaya nilai dari Worker, tidak hitung ulang). Logic jual sendiri (average cost, Realized P/L) BELUM diport ke Worker (lihat `investments/service.ts` di apps/worker), jadi baris jual di D1 saat ini selalu lahir dari push desktop — nilai turunannya sudah benar sejak awal, pull cuma mengembalikannya.

## `upsertLabelJunction` / `applyLabelJunctionRow`

Dipakai bertiga (`transaction_labels`/`category_labels`/`account_labels`) — bentuknya identik, cuma beda nama tabel + nama kolom entity.

`ON CONFLICT(entity_id, label_id)`, BUKAN `ON CONFLICT(id)`: baris junction diidentifikasi oleh PASANGANnya (itu yang UNIQUE), `id` cuma ikut serta. Device lain bisa saja sudah punya pasangan yang sama dengan `id` berbeda (mis. baris lokal dibuat offline, lalu baris D1 untuk pasangan yang sama datang dari MCP) — `ON CONFLICT(id)` tidak akan melihat bentrokan itu dan INSERT-nya pecah UNIQUE constraint 2067, persis bug yang diperbaiki 2026-10-10 di `apply-*-labels.ts`. `id` SENGAJA tidak ikut di-update saat konflik: biarkan `id` lokal yang menang supaya baris yang sudah terlanjur dirujuk antrian push lokal tidak berubah identitas di tengah jalan.

Hard-delete saat `deletedAt` terisi juga menyasar pasangan, bukan `id`, supaya detach dari device lain tetap kena walau `id` lokalnya kebetulan beda.

## `upsertCategoryPeriod` / `applyCategoryPeriodRow`

`row.categoryIds` dari snapshot `/sync` sudah di-JOIN+GROUP_CONCAT jadi `string[]` category_id polos di Worker (bukan baris pivot `{id, categoryId}` — lihat "Perluasan `/sync`" di `apps/worker/docs/todos/done/category-period.md`), jadi `id` pivot lokal di-generate baru di sini. Replace-all (DELETE semua pivot lama + INSERT ulang), pola persis `use-update-category-period.ts` di sisi desktop — pivot id sendiri cuma row identifier teknis (cloud_sync_queue/D1 PK), tidak ada makna yang perlu dipertahankan lintas device.

Hard-delete periode ikut menghapus pivotnya lewat `ON DELETE CASCADE` (`0048_category_periods_many_categories.sql`) — beda dari Worker yang sengaja biarkan pivot menggantung saat soft-delete (lihat catatan `deleteCategoryPeriod` di `apps/worker/src/modules/category-periods/service.ts`).

## Siapa yang update checkpoint

`applySyncResponse` (di `index.ts`) tidak mengurus checkpoint — caller bertanggung jawab update checkpoint (`useSetCloudSyncCheckpoint`) SETELAH `applySyncResponse` resolve sukses.

## `applyRow` menelan error per baris, bukan per seluruh pull

**Bug ditemukan 2026-10-22** (dogfooding `third_party_funds`): entity baru bisa merujuk FK ke parent (kontak/akun) yang `updated_at`-nya LEBIH LAMA dari checkpoint lokal — filter incremental `WHERE updated_at > since` di Worker otomatis melewatkan parent itu di SETIAP `/sync` berikutnya, padahal child-nya (baru) tetap lolos. Sebelum fix ini, FOREIGN KEY constraint failed pada satu baris melempar exception yang membatalkan SELURUH `runPull` (termasuk `setCheckpoint`) — pull tidak akan pernah sukses lagi walau 99% data lain sehat, dan errornya tidak terlihat (tertelan `catch {}` kosong di `use-pull-sync/index.ts`, sudah diperbaiki jadi `console.error`).

`applyRow` sekarang membungkus `upsert`/`DELETE` per baris dengan try/catch: gagal → catat ke `cloud_sync_rejected_log` (`log-rejected-row.ts`) lalu lanjut ke baris berikutnya, TIDAK menghentikan pull. Ini bukan solusi akar (parent yang "lama" tetap tidak ikut ter-pull) — cuma pagar supaya satu baris rusak tidak memblokir semua sync selamanya. Kalau baris yang gagal perlu benar-benar masuk, trigger parent-nya untuk ter-`updated_at` ulang (apa pun jalurnya) supaya ikut lolos filter incremental di pull berikutnya, SELAGI checkpoint belum melewati `updated_at` baris anak yang gagal — begitu checkpoint maju lewat itu, Worker tidak akan mengirim ulang baris anak itu sama sekali.
