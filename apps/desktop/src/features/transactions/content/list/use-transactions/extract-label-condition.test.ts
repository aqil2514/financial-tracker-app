import { describe, expect, it } from "vitest";

import { extractLabelCondition } from "./extract-label-condition";
import type { FilterConfig } from "@/components/query/filters/filter.interface";

describe("extractLabelCondition", () => {
  it("tanpa filter label: remaining utuh, tidak ada extraCondition", () => {
    const filters: FilterConfig[] = [{ filterKey: "note", filterOperator: "ilike", filterValue: "test" }];
    const { remaining, extraConditions } = extractLabelCondition(filters, 1);

    expect(remaining).toEqual(filters);
    expect(extraConditions).toHaveLength(0);
  });

  it('operator "eq" (Adalah), satu nama: subquery label efektif positif, params cuma 1 nama', () => {
    const filters: FilterConfig[] = [{ filterKey: "label", filterOperator: "eq", filterValue: ["Konsumtif"] }];
    const { remaining, extraConditions } = extractLabelCondition(filters, 1);

    expect(remaining).toHaveLength(0);
    expect(extraConditions).toHaveLength(1);
    expect(extraConditions[0].condition).not.toMatch(/^NOT/);
    expect(extraConditions[0].condition).toContain("$1");
    expect(extraConditions[0].params).toEqual(["Konsumtif"]);
  });

  it('operator "eq", DUA nama sekaligus: union/OR semantics, placeholder $1 DAN $2', () => {
    const filters: FilterConfig[] = [
      { filterKey: "label", filterOperator: "eq", filterValue: ["Konsumtif", "Produktif"] },
    ];
    const { extraConditions } = extractLabelCondition(filters, 1);

    expect(extraConditions).toHaveLength(1);
    expect(extraConditions[0].condition).toContain("$1");
    expect(extraConditions[0].condition).toContain("$2");
    expect(extraConditions[0].params).toEqual(["Konsumtif", "Produktif"]);
  });

  it('operator "neq" (Bukan): condition diawali NOT, params tetap terkirim', () => {
    const filters: FilterConfig[] = [{ filterKey: "label", filterOperator: "neq", filterValue: ["Konsumtif"] }];
    const { extraConditions } = extractLabelCondition(filters, 1);

    expect(extraConditions).toHaveLength(1);
    expect(extraConditions[0].condition).toMatch(/^NOT/);
    expect(extraConditions[0].params).toEqual(["Konsumtif"]);
  });

  it('operator "is_null" (Kosong): NOT dari subquery "ada label apa pun", TANPA params', () => {
    const filters: FilterConfig[] = [{ filterKey: "label", filterOperator: "is_null", filterValue: null }];
    const { extraConditions } = extractLabelCondition(filters, 1);

    expect(extraConditions).toHaveLength(1);
    expect(extraConditions[0].condition).toMatch(/^NOT/);
    expect(extraConditions[0].condition).not.toContain("$1");
    expect(extraConditions[0].params ?? []).toHaveLength(0);
  });

  it('operator "is_not_null" (Tidak kosong): subquery "ada label apa pun" tanpa NOT, TANPA params', () => {
    const filters: FilterConfig[] = [{ filterKey: "label", filterOperator: "is_not_null", filterValue: null }];
    const { extraConditions } = extractLabelCondition(filters, 1);

    expect(extraConditions).toHaveLength(1);
    expect(extraConditions[0].condition).not.toMatch(/^NOT/);
    expect(extraConditions[0].params ?? []).toHaveLength(0);
  });

  it("startIndex > 1 (ada extraCondition lain duluan): placeholder lanjut dari situ, tidak mulai dari $1 lagi", () => {
    const filters: FilterConfig[] = [{ filterKey: "label", filterOperator: "eq", filterValue: ["Konsumtif"] }];
    const { extraConditions } = extractLabelCondition(filters, 3);

    expect(extraConditions[0].condition).toContain("$3");
    expect(extraConditions[0].condition).not.toContain("$1");
  });

  it("filterValue kosong (array []): diabaikan, tidak jadi extraCondition", () => {
    const filters: FilterConfig[] = [{ filterKey: "label", filterOperator: "eq", filterValue: [] }];
    const { extraConditions } = extractLabelCondition(filters, 1);

    expect(extraConditions).toHaveLength(0);
  });

  it("filter lain tetap lolos ke remaining, cuma 'label' yang diekstrak", () => {
    const filters: FilterConfig[] = [
      { filterKey: "note", filterOperator: "ilike", filterValue: "beli" },
      { filterKey: "label", filterOperator: "eq", filterValue: ["Produktif"] },
      { filterKey: "amount", filterOperator: "gt", filterValue: 1000 },
    ];
    const { remaining, extraConditions } = extractLabelCondition(filters, 1);

    expect(remaining).toEqual([
      { filterKey: "note", filterOperator: "ilike", filterValue: "beli" },
      { filterKey: "amount", filterOperator: "gt", filterValue: 1000 },
    ]);
    expect(extraConditions).toHaveLength(1);
  });
});
