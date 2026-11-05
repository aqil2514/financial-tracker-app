import { describe, expect, it } from "vitest";
import {
  buildAccountFilter,
  buildOpeningQuery,
  buildSeriesQuery,
  toBalanceTrendFilter,
  toRunningBalance,
  type BalanceTrendFilter,
} from "./balance-trend-query";

const EMPTY: BalanceTrendFilter = { accountTypes: [], groupIds: [], accountIds: [] };

function placeholderCount(sql: string) {
  return (sql.match(/\?/g) ?? []).length;
}

describe("toBalanceTrendFilter", () => {
  it("menerjemahkan FilterConfig eq ke filter akun, mengabaikan operator lain", () => {
    expect(
      toBalanceTrendFilter([
        { filterKey: "account_type", filterOperator: "eq", filterValue: ["cash", "debt"] },
        { filterKey: "group_id", filterOperator: "neq", filterValue: ["g1"] },
      ])
    ).toEqual({ accountTypes: ["cash", "debt"], groupIds: [], accountIds: [] });
  });
});

describe("buildAccountFilter", () => {
  it("tanpa filter: hanya akun aktif", () => {
    expect(buildAccountFilter(EMPTY)).toEqual({ sql: "AND a.is_active = 1", params: [] });
  });

  it("tipe dan grup digabung AND dengan syarat akun aktif", () => {
    const { sql, params } = buildAccountFilter({ ...EMPTY, accountTypes: ["cash"], groupIds: ["g1", "g2"] });
    expect(sql).toBe("AND a.is_active = 1 AND a.account_type IN (?) AND a.group_id IN (?, ?)");
    expect(params).toEqual(["cash", "g1", "g2"]);
  });

  it("akun spesifik dipilih: syarat aktif dilepas supaya akun nonaktif ikut", () => {
    const { sql } = buildAccountFilter({ ...EMPTY, accountIds: ["a1"] });
    expect(sql).toBe("AND a.id IN (?)");
  });
});

describe("query builders", () => {
  const filter: BalanceTrendFilter = { accountTypes: ["cash"], groupIds: ["g1"], accountIds: [] };

  it("saldo awal: jumlah placeholder = jumlah params, `from` dua kali di depan", () => {
    const { sql, params } = buildOpeningQuery("2026-10-01", filter);
    expect(placeholderCount(sql)).toBe(params.length);
    expect(params).toEqual(["2026-10-01", "2026-10-01", "cash", "g1"]);
  });

  it("deret: urutan params = rentang + filter untuk SELECT pertama, lalu diulang untuk kedua", () => {
    const { sql, params } = buildSeriesQuery("2026-10-01", "2026-10-31", "month", filter);
    expect(placeholderCount(sql)).toBe(params.length);
    expect(params).toEqual([
      "2026-10-01", "2026-10-31", "cash", "g1",
      "2026-10-01", "2026-10-31", "cash", "g1",
    ]);
    expect(sql).toContain("strftime('%Y-%m'");
  });

  it("granularitas memilih format strftime", () => {
    expect(buildSeriesQuery("a", "b", "day", EMPTY).sql).toContain("'%Y-%m-%d'");
    expect(buildSeriesQuery("a", "b", "week", EMPTY).sql).toContain("'%Y-%W'");
    expect(buildSeriesQuery("a", "b", "year", EMPTY).sql).toContain("'%Y'");
  });
});

describe("toRunningBalance", () => {
  it("menjumlahkan perubahan bersih berurutan dari saldo awal", () => {
    expect(
      toRunningBalance(1000, [
        { point: "2026-10-01", net: -200 },
        { point: "2026-10-02", net: 500 },
      ])
    ).toEqual([
      { label: "2026-10-01", balance: 800 },
      { label: "2026-10-02", balance: 1300 },
    ]);
  });
});
