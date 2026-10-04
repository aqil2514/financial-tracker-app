-- Backfill transaksi utk `debts`/`debt_payments` yang `transaction_id`
-- NULL -- pelanggaran docs/concept/konsep-transaksi.md ("saldo akun
-- HANYA bisa berubah lewat transactions"), ditemukan 2026-10-04 lewat
-- audit database production. Ditulis EKSPLISIT per baris (bukan query
-- generik) karena hasil investigasi manual menemukan pola CAMPURAN,
-- tidak seragam -- generic matching by amount+date sempat salah
-- menduplikasi transaksi yang TERNYATA sudah ada (lihat draft awal
-- migrasi ini yang DIBATALKAN setelah dry-run menunjukkan saldo akun
-- "Orang Lain" jadi -150000, dobel dari pelunasan yang sudah tercatat).
--
-- 4 kategori per baris, HASIL VERIFIKASI MANUAL (bukan asumsi):
--   A. Debt pokok YANG TRANSAKSINYA SUDAH ADA (transfer nyata, link-nya
--      saja yang hilang, kemungkinan data import lama) -> UPDATE
--      transaction_id, TIDAK membuat transaksi baru.
--   B. Debt pokok YANG MEMANG TIDAK PERNAH ADA transaksi (2 debt lama
--      status 'paid' -- "Kak Ipit" & "Mama Dicky" -- pelunasannya sudah
--      tercatat tapi pokoknya tidak pernah, keputusan: tetap lengkapi
--      riwayat biar konsisten "piutang lahir dari transaksi") DAN 1
--      debt BARU hari ini yg account_id-nya BENAR (mode 'direct', murni
--      belum ada transaksi sama sekali) -> INSERT transaksi baru.
--   C. debt_payments yang transaksinya SUDAH ADA (transfer nyata) ->
--      UPDATE transaction_id saja.
--   D. Debt "Piutang Retailku" (payable, Rp4.500, written_off) --
--      SALAH INPUT sejak awal (account_id menunjuk akun "Piutang",
--      padahal type='payable' seharusnya ke akun utang) -- dikonfirmasi
--      user: hapus saja, BUKAN backfill. DELETE 3 baris terkait (anak ->
--      induk): debt_payments write-off-nya, transaksi penutup write-off
--      itu sendiri, baru baris `debts`-nya.
--
-- Arah tanda (docs/concept/konsep-utang-piutang.md): pokok receivable
-- -> income (+), pokok payable -> expense (-). Kategori A/C di sini
-- SEMUA type='transfer' asli (bukan income/expense) karena memang
-- dicatat sebagai transfer kas<->debt saat itu -- hanya di-link, bukan
-- diganti jenisnya.

-- ============================================================
-- A. Debt pokok "Nde Munan" -- link ke transfer existing (2 baris).
-- ============================================================

UPDATE debts SET transaction_id = '01a0ef4c-10c9-746e-bde9-3742f947332a'
WHERE id = '01a0ef4c-10dd-7053-9d95-161e1a6b3952' AND transaction_id IS NULL;

UPDATE debts SET transaction_id = '01a0ef4c-10c9-730b-85a8-b572fcf01353'
WHERE id = '01a0ef4c-10dd-78bd-8ec2-34276c23ca2d' AND transaction_id IS NULL;

-- ============================================================
-- C. debt_payments -- link ke transfer existing (3 baris).
-- ============================================================

UPDATE debt_payments SET transaction_id = '01a0ef4c-10c9-7eb2-94c2-c0a977bba569'
WHERE id = '01a0ef4c-10df-7c77-a2e9-21cf98ee99c8' AND transaction_id IS NULL;

UPDATE debt_payments SET transaction_id = '01a0ef4c-10c9-77c9-a8e5-621815367e53'
WHERE id = '01a0ef4c-10df-7de6-82dd-5a4725d64188' AND transaction_id IS NULL;

UPDATE debt_payments SET transaction_id = '01a0ef4c-10c9-77e8-89a7-309b7830d75d'
WHERE id = '01a0ef4c-10df-7491-81db-9c416b1bffd3' AND transaction_id IS NULL;

-- ============================================================
-- B. Debt pokok tanpa transaksi sama sekali -- buat baru (3 baris:
--    2 lama status 'paid' + 1 baru hari ini yg account_id-nya benar).
--    UUID literal di-generate sekali per baris memakai ekspresi yang
--    sama dengan 0027/0032, dibungkus subquery scalar supaya tiap
--    INSERT dapat id sendiri.
-- ============================================================

INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, description, date, contact_id)
SELECT
    lower(
        printf('%08x', (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) >> 16) & 0xffffffff)
        || '-' || printf('%04x', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) & 0xffff)
        || '-7' || substr(hex(randomblob(2)), 1, 3)
        || '-' || substr('89ab', (abs(random()) % 4) + 1, 1) || substr(hex(randomblob(2)), 1, 3)
        || '-' || hex(randomblob(6))
    ),
    CASE WHEN d.type = 'receivable' THEN 'income' ELSE 'expense' END,
    d.amount, NULL, d.account_id, NULL,
    COALESCE(NULLIF(d.note, ''), 'Backfill pokok piutang/utang (migrasi 0033)'),
    NULL, d.date, d.contact_id
FROM debts d
WHERE d.id IN (
    '01a0ef4c-10dd-7da7-9825-369de5c8974c', -- Kak Ipit, paid, 196243
    '01a0ef4c-10dd-7b04-bb9f-d17583199424', -- Mama Dicky, paid, 150000
    '01a10684-aa14-7384-ac21-9e02ed1aa21a'   -- Utang Dagang, ongoing, 4500
  )
  AND d.transaction_id IS NULL;

UPDATE debts
SET transaction_id = (
    SELECT t.id FROM transactions t
    WHERE t.account_id = debts.account_id
      AND t.amount = debts.amount
      AND t.date = debts.date
      AND t.type = CASE WHEN debts.type = 'receivable' THEN 'income' ELSE 'expense' END
      AND t.description IS NULL
      AND t.note = COALESCE(NULLIF(debts.note, ''), 'Backfill pokok piutang/utang (migrasi 0033)')
    ORDER BY t.created_at DESC
    LIMIT 1
)
WHERE debts.id IN (
    '01a0ef4c-10dd-7da7-9825-369de5c8974c',
    '01a0ef4c-10dd-7b04-bb9f-d17583199424',
    '01a10684-aa14-7384-ac21-9e02ed1aa21a'
  )
  AND debts.transaction_id IS NULL;

-- ============================================================
-- D. Debt "Piutang Retailku" salah input -- hapus total (anak -> induk).
-- ============================================================

DELETE FROM debt_payments WHERE debt_id = '01a10683-f67a-7cae-a586-8c0312a40336';
DELETE FROM transactions WHERE id = '01a10684-1469-74d8-9c94-469825d21f15';
DELETE FROM debts WHERE id = '01a10683-f67a-7cae-a586-8c0312a40336';
