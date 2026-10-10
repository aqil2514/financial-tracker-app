import { describe, expect, it } from "vitest";

import { buildPrimaryEffectiveLabelSubquery } from "./primary-label-subquery";

describe("buildPrimaryEffectiveLabelSubquery", () => {
  // Regresi: versi pertama fragment ini menulis `transactions.id` mati
  // (meniru 2 fragment label lain) dan langsung pecah dgn "no such
  // column: transactions.id" begitu dipakai di query cashflow yang
  // memang beralias `FROM transactions t`.
  it("memakai alias yang diberikan, bukan nama tabel penuh", () => {
    const sql = buildPrimaryEffectiveLabelSubquery("t");

    expect(sql).toContain("tl.transaction_id = t.id");
    expect(sql).toContain("cl.category_id = t.category_id");
    expect(sql).not.toContain("transactions.");
  });

  it("MIN(l.name) dipakai di kedua cabang -- 1 label per transaksi, bukan semua", () => {
    const sql = buildPrimaryEffectiveLabelSubquery("t");

    expect(sql.match(/MIN\(l\.name\)/g)).toHaveLength(2);
    expect(sql).not.toContain("GROUP_CONCAT");
  });

  it("baris junction & label yang sudah soft-delete dikecualikan", () => {
    const sql = buildPrimaryEffectiveLabelSubquery("t");

    expect(sql).toContain("tl.deleted_at IS NULL");
    expect(sql).toContain("cl.deleted_at IS NULL");
    expect(sql).toContain("l.deleted_at IS NULL");
  });
});
