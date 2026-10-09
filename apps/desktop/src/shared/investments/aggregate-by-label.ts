import type { AccountWithBalance } from "@/features/accounts";
import type { InvestmentAccountLabelRow } from "./use-investment-account-labels";

export type InvestmentLabelBreakdownRow = {
  label: string;
  totalModal: number;
  totalMarketValue: number;
  totalPl: number;
};

const UNLABELED = "Tanpa Label";

/**
 * Agregasi P/L investasi per label jenis instrumen (scope 'account') --
 * keputusan 2026-10-10: akun dgn LEBIH DARI SATU label dihitung PENUH
 * di SETIAP label yang dimilikinya (bukan dibagi/dipartisi), jadi total
 * lintas baris hasil fungsi ini BISA melebihi total modal sungguhan kalau
 * ada akun multi-label -- overlap disengaja, dua dimensi label beda
 * konsep (lihat general-label.md "Draf skema" soal akun bisa berlabel
 * "RDPU" DAN "Dana Darurat" bersamaan). Akun TANPA label sama sekali
 * masuk grup "Tanpa Label" (bukan diam-diam dihilangkan dari agregasi).
 */
export function aggregateInvestmentByLabel(
  investmentAccounts: AccountWithBalance[],
  marketValueByAccountId: Map<string, number>,
  accountLabels: InvestmentAccountLabelRow[]
): InvestmentLabelBreakdownRow[] {
  const labelsByAccountId = new Map<string, string[]>();
  for (const row of accountLabels) {
    const existing = labelsByAccountId.get(row.account_id) ?? [];
    existing.push(row.name);
    labelsByAccountId.set(row.account_id, existing);
  }

  const byLabel = new Map<string, { totalModal: number; totalMarketValue: number }>();

  for (const account of investmentAccounts) {
    const labels = labelsByAccountId.get(account.id) ?? [];
    const targetLabels = labels.length > 0 ? labels : [UNLABELED];
    const marketValue = marketValueByAccountId.get(account.id) ?? 0;

    for (const label of targetLabels) {
      const current = byLabel.get(label) ?? { totalModal: 0, totalMarketValue: 0 };
      current.totalModal += account.balance;
      current.totalMarketValue += marketValue;
      byLabel.set(label, current);
    }
  }

  return Array.from(byLabel.entries())
    .map(([label, { totalModal, totalMarketValue }]) => ({
      label,
      totalModal,
      totalMarketValue,
      totalPl: totalMarketValue - totalModal,
    }))
    .sort((a, b) => b.totalMarketValue - a.totalMarketValue);
}
