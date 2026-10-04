-- Backfill `id` transaksi yang NULL akibat bug di
-- use-correct-account-balance.ts (INSERT "Koreksi Saldo" tidak pernah
-- menyertakan kolom `id` sejak migrasi 0027 ke TEXT PRIMARY KEY tanpa
-- DEFAULT -- insert tanpa kolom id otomatis tersimpan sebagai NULL).
-- Dampaknya: transaksi itu MUNCUL di list (SELECT * tidak peduli id
-- NULL) tapi dialog Edit/Detail selalu gagal diam-diam (query `WHERE
-- id = $1` tidak pernah match NULL, hasilnya `null`, bukan error).
--
-- Ekspresi UUID v7 sama persis dengan 0027_uuid_primary_keys.sql.

UPDATE transactions
SET id = lower(
    printf('%08x', (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) >> 16) & 0xffffffff)
    || '-' || printf('%04x', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) & 0xffff)
    || '-7' || substr(hex(randomblob(2)), 1, 3)
    || '-' || substr('89ab', (abs(random()) % 4) + 1, 1) || substr(hex(randomblob(2)), 1, 3)
    || '-' || hex(randomblob(6))
)
WHERE id IS NULL;
