import { describe, expect, it } from "vitest";

import { aggregateInvestmentByLabel } from "./aggregate-by-label";
import type { AccountWithBalance } from "@/features/accounts";

function account(id: string, balance: number): AccountWithBalance {
  return { id, balance } as AccountWithBalance;
}

describe("aggregateInvestmentByLabel", () => {
  it("1 akun 1 label: modal/nilai pasar/P&L masuk penuh ke label itu", () => {
    const result = aggregateInvestmentByLabel(
      [account("acc1", 1_000_000)],
      new Map([["acc1", 1_200_000]]),
      [{ account_id: "acc1", name: "RDPU" }]
    );

    expect(result).toEqual([
      { label: "RDPU", totalModal: 1_000_000, totalMarketValue: 1_200_000, totalPl: 200_000 },
    ]);
  });

  it("akun TANPA label sama sekali -> masuk grup 'Tanpa Label', bukan hilang", () => {
    const result = aggregateInvestmentByLabel(
      [account("acc1", 500_000)],
      new Map([["acc1", 400_000]]),
      []
    );

    expect(result).toEqual([
      { label: "Tanpa Label", totalModal: 500_000, totalMarketValue: 400_000, totalPl: -100_000 },
    ]);
  });

  it("akun dgn >1 label -- dihitung PENUH di SETIAP label (overlap disengaja), total lintas baris > total modal sungguhan", () => {
    const result = aggregateInvestmentByLabel(
      [account("acc1", 1_000_000)],
      new Map([["acc1", 1_000_000]]),
      [
        { account_id: "acc1", name: "RDPU" },
        { account_id: "acc1", name: "Dana Darurat" },
      ]
    );

    expect(result).toHaveLength(2);
    const totalAcrossRows = result.reduce((sum, row) => sum + row.totalModal, 0);
    // 2x modal asli (Rp1jt muncul penuh di DUA label) -- overlap SENGAJA,
    // bukan bug, lihat komentar aggregate-by-label.ts.
    expect(totalAcrossRows).toBe(2_000_000);
    expect(result.find((r) => r.label === "RDPU")?.totalModal).toBe(1_000_000);
    expect(result.find((r) => r.label === "Dana Darurat")?.totalModal).toBe(1_000_000);
  });

  it("banyak akun beda label -- masing2 terpisah, tidak campur", () => {
    const result = aggregateInvestmentByLabel(
      [account("acc1", 1_000_000), account("acc2", 2_000_000)],
      new Map([
        ["acc1", 1_100_000],
        ["acc2", 1_800_000],
      ]),
      [
        { account_id: "acc1", name: "RDPU" },
        { account_id: "acc2", name: "Saham" },
      ]
    );

    expect(result.find((r) => r.label === "RDPU")).toEqual({
      label: "RDPU",
      totalModal: 1_000_000,
      totalMarketValue: 1_100_000,
      totalPl: 100_000,
    });
    expect(result.find((r) => r.label === "Saham")).toEqual({
      label: "Saham",
      totalModal: 2_000_000,
      totalMarketValue: 1_800_000,
      totalPl: -200_000,
    });
  });

  it("banyak akun label SAMA -- digabung (SUM), bukan baris terpisah per akun", () => {
    const result = aggregateInvestmentByLabel(
      [account("acc1", 1_000_000), account("acc2", 2_000_000)],
      new Map([
        ["acc1", 1_000_000],
        ["acc2", 2_000_000],
      ]),
      [
        { account_id: "acc1", name: "RDPU" },
        { account_id: "acc2", name: "RDPU" },
      ]
    );

    expect(result).toEqual([
      { label: "RDPU", totalModal: 3_000_000, totalMarketValue: 3_000_000, totalPl: 0 },
    ]);
  });

  it("akun belum punya nilai pasar (map tidak punya entry) -- dianggap 0, bukan dihilangkan dari agregasi", () => {
    const result = aggregateInvestmentByLabel(
      [account("acc1", 500_000)],
      new Map(),
      [{ account_id: "acc1", name: "RDPU" }]
    );

    expect(result).toEqual([
      { label: "RDPU", totalModal: 500_000, totalMarketValue: 0, totalPl: -500_000 },
    ]);
  });

  it("tidak ada akun sama sekali -> array kosong", () => {
    expect(aggregateInvestmentByLabel([], new Map(), [])).toEqual([]);
  });

  it("hasil diurutkan DESC by totalMarketValue", () => {
    const result = aggregateInvestmentByLabel(
      [account("acc1", 100), account("acc2", 100)],
      new Map([
        ["acc1", 100],
        ["acc2", 900],
      ]),
      [
        { account_id: "acc1", name: "Kecil" },
        { account_id: "acc2", name: "Besar" },
      ]
    );

    expect(result.map((r) => r.label)).toEqual(["Besar", "Kecil"]);
  });
});
