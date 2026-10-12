# `entities/category-periods`

Fungsi baca yang dimiliki entitas `categoryPeriods`, dihitung dari `SyncSnapshot` (hasil `/sync` Worker), bukan query SQL terpisah.

## `list-category-periods.ts`

`listCategoryPeriods` — filter periode kategori yang hidup, opsional difilter nama (substring, case-insensitive) dan/atau `categoryId` anggota.

## `get-category-period-summary.ts`

`getCategoryPeriodSummary` — match persis `getCategoryPeriodSummary` di `apps/worker/src/modules/category-periods/service.ts` dan `useCategoryPeriodSummary` (desktop). Dihitung dari `transactions` yang SUDAH ada di snapshot yang sama, bukan request HTTP terpisah per periode (lihat "Baca vs tulis" di `docs/todos/plan/category-period.md`).
