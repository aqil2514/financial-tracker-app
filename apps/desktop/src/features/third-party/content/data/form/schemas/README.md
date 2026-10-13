# Schema: titip/ambil dana pihak ketiga

Form titip-masuk/ambil-keluar dana pihak ketiga — satu baris `third_party_funds`, lahir dari transaksi `income`/`expense` SATU SISI pada akun `third_party` (BUKAN transfer cash↔third_party, lihat [docs/concept/konsep-dana-pihak-ketiga.md](../../../../../../../docs/concept/konsep-dana-pihak-ketiga.md)).

Beda dari `newDebtSchema` (`shared/debts/new-debt-form/schema.ts`): tidak ada `record_mode`/`cash_account_id` sama sekali, karena third_party TIDAK PERNAH menyentuh akun kas lewat transaksi ini — cuma satu akun (`third_party`) + satu kontak yang terlibat.

## Field

- `direction` — `'in'` = ada yang nitip (income pada akun third_party), `'out'` = ada yang ambil (expense pada akun third_party).
- `account_id` — akun `third_party` yang dipilih.
- `contact_name` — reuse `ContactField` yang sama dipakai form transaksi/debt (resolve nama→id, create-if-not-exists saat submit).
- `amount`, `date` — standar.
- `note` — wajib diisi di form, walau kolom `third_party_funds.note` sendiri nullable di DB.

## Validasi oversell

Validasi "ambil melebihi sisa titipan kontak itu di akun itu" **tidak** ada di `schema.ts` — butuh query async ke DB (SUM riwayat `third_party_funds`), jadi ditangani di mutation (`use-create-*.ts`) lewat error custom, pola sama `InsufficientInvestmentUnitsError` di `shared/investments/apply-sell-investment-transaction.ts`.
