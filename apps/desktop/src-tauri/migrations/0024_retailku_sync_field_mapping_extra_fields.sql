-- Perluas `retailku_sync_field_mapping` dgn 2 kolom umum, dipakai
-- LINTAS `sourceType` (bukan cuma FUND_TRANSFER) — lihat diskusi
-- handover 2026-09-28 & docs/todos/plan/retailku-dynamic-sourcetype-mapping.md
-- (Keputusan terbuka #2).
--
-- `source_kind` — identitas EKSPLISIT klasifikasi baris ("generic",
-- "transfer", dst — SAMA istilah dgn `MappingRowDraft.sourceType` di
-- kode TS). SEBELUMNYA klasifikasi ini cuma tersirat dari FORMAT
-- STRING `key` (`detail:...`/`transfer:...`), harus di-parse tiap kali
-- dibutuhkan (sumber bug nyata: `formatMappingKeyLabel` sempat salah
-- parse key transfer sbg format detail, hasil label "undefined").
-- Kolom ini membuat klasifikasi jadi DATA, bukan hasil parsing string.
-- DEFAULT 'generic' — SEMUA baris lama (sebelum kolom ini ada) memang
-- generic, tidak perlu backfill manual.
--
-- `extra_fields` — JSON nullable, bentuk BEBAS tergantung `source_kind`
-- (TIDAK perlu kolom baru tiap ada kebutuhan spesifik satu sourceType
-- — mis. `{"noteFollowSource":true,"descriptionFollowSource":false}`
-- utk toggle "Mengikuti Retailku" pada FUND_TRANSFER). Dipilih drpd
-- kolom boolean eksplisit krn makin banyak `sourceType` spesial
-- direncanakan (consignment, provider-payout, dst), tiap satu berpotensi
-- butuh field kecil berbeda-beda — kolom eksplisit akan terus menumpuk.

ALTER TABLE retailku_sync_field_mapping
    ADD COLUMN source_kind TEXT NOT NULL DEFAULT 'generic';

ALTER TABLE retailku_sync_field_mapping
    ADD COLUMN extra_fields TEXT;
