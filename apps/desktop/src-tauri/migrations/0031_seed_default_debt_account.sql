-- Akun debt default — "rumah" untuk piutang/utang mode 'direct' (lihat
-- docs/concept/konsep-tipe-akun.md: debt.account_id harus tetap menumpu
-- ke akun bertipe 'debt', bukan NULL). Insert cuma kalau belum ada akun
-- debt sama sekali -- user yang sudah bikin akun debt sendiri (manual)
-- sebelum migrasi ini tidak perlu akun kedua.
INSERT INTO accounts (id, name, icon, initial_balance, account_type)
SELECT '01a101ab-baf8-7aea-9d0a-c99a5edbded6', 'Utang & Piutang', 'handshake', 0, 'debt'
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE account_type = 'debt');

-- Backfill: baris debts hasil mode 'direct' LAMA (account_id NULL sejak
-- lahir, bukan hasil ON DELETE SET NULL) sekarang ditautkan ke akun debt
-- pertama yang ada (seed di atas, atau akun debt manual user kalau sudah
-- ada sebelum migrasi ini) -- supaya prinsip "akun sebagai tumpuan semua
-- data" konsisten utk data lama maupun baru.
--
-- Scope SENGAJA cuma source='manual' -- baris dari sync Retailku
-- (source='retailku_sync') yang account_id-nya NULL itu keputusan desain
-- terpisah (lihat audit-kepatuhan-konsep-tipe-akun.md pertanyaan #2,
-- BELUM diputuskan), tidak disentuh di sini.
UPDATE debts
SET account_id = (SELECT id FROM accounts WHERE account_type = 'debt' ORDER BY created_at LIMIT 1)
WHERE account_id IS NULL AND transaction_id IS NULL AND source = 'manual';

-- debt_payments tidak punya kolom source sendiri -- diturunkan dari
-- debts.source lewat debt_id, utk konsistensi scope yang sama.
UPDATE debt_payments
SET account_id = (SELECT id FROM accounts WHERE account_type = 'debt' ORDER BY created_at LIMIT 1)
WHERE account_id IS NULL
  AND transaction_id IS NULL
  AND debt_id IN (SELECT id FROM debts WHERE source = 'manual');
