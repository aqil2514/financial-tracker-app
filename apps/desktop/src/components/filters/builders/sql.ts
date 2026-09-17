import type { FilterConfig, FilterRangeValue } from "../filter.interface";

export interface WhereClauseResult {
  whereClause: string;
  params: (string | number)[];
}

export interface ExtraCondition {
  condition: string;
  params?: (string | number)[];
}

/**
 * Menerjemahkan FilterConfig[] (+ kondisi manual tambahan di luar
 * sistem filter, mis. filter tanggal dari kalender) langsung jadi
 * `whereClause` string siap disisipkan ke query SQLite — sudah
 * termasuk kata "WHERE ..." (atau string kosong kalau tidak ada
 * kondisi sama sekali), dan `params` sudah tergabung urut sesuai
 * posisi `$1`, `$2`, dst di dalam `whereClause`.
 *
 * Kondisi dari `filters` generik berdasarkan `filterOperator` — tidak
 * peduli nama kolomnya apa. `filterKey` disisipkan LANGSUNG sebagai
 * nama kolom SQL (bukan lewat parameter terikat, karena SQLite tidak
 * bisa mem-bind nama kolom). Untuk mencegah SQL injection lewat nama
 * kolom, `allowedColumns` WAJIB diisi dengan daftar kolom yang sah
 * untuk tabel terkait — filter dengan `filterKey` di luar daftar itu
 * akan melempar error, bukan diam-diam diloloskan.
 *
 * `extraConditions` untuk kondisi di luar sistem FilterConfig (mis.
 * filter tanggal dari kalender yang bukan bagian dari filter panel).
 * Ditempatkan SEBELUM kondisi dari `filters` supaya nomor parameter
 * ($1, $2, ...) yang ditulis di `extraConditions` tetap sesuai posisi
 * aslinya, tanpa perlu pemanggil menghitung offset manual.
 *
 * Operator yang belum dikenali builder ini (mis. saat tipe field baru
 * ditambah tapi builder belum diperbarui) sengaja melempar error di
 * `default`, bukan diam-diam diabaikan.
 */
export function buildWhereClause(
  filters: FilterConfig[],
  allowedColumns: readonly string[],
  extraConditions: ExtraCondition[] = []
): WhereClauseResult {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  for (const extra of extraConditions) {
    conditions.push(extra.condition);
    params.push(...(extra.params ?? []));
  }

  function nextIndex() {
    return params.length + 1;
  }

  for (const filter of filters) {
    const { filterKey, filterOperator, filterValue } = filter;
    if (!filterKey) continue;

    if (!allowedColumns.includes(filterKey)) {
      throw new Error(
        `[buildWhereClause] Kolom "${filterKey}" tidak ada di allowedColumns. ` +
          `Pastikan FILTER_CONFIG dan allowedColumns memakai nama kolom yang sama persis.`
      );
    }

    switch (filterOperator) {
      case "is_null": {
        conditions.push(`${filterKey} IS NULL`);
        break;
      }

      case "is_not_null": {
        conditions.push(`${filterKey} IS NOT NULL`);
        break;
      }

      case "ilike":
      case "not_ilike": {
        if (typeof filterValue !== "string" || filterValue === "") break;
        const notPrefix = filterOperator === "not_ilike" ? "NOT " : "";
        conditions.push(`${notPrefix}${filterKey} LIKE $${nextIndex()}`);
        params.push(`%${filterValue}%`);
        break;
      }

      case "eq":
      case "neq": {
        const values = Array.isArray(filterValue)
          ? filterValue.map(String)
          : filterValue != null
            ? [String(filterValue)]
            : [];
        if (values.length === 0) break;

        const notPrefix = filterOperator === "neq" ? "NOT " : "";
        const placeholders = values
          .map((value) => {
            const index = nextIndex();
            params.push(value);
            return `$${index}`;
          })
          .join(", ");
        conditions.push(`${notPrefix}${filterKey} IN (${placeholders})`);
        break;
      }

      case "gt":
      case "gte":
      case "lt":
      case "lte": {
        if (typeof filterValue !== "number") break;
        const sqlOperator = { gt: ">", gte: ">=", lt: "<", lte: "<=" }[filterOperator];
        conditions.push(`${filterKey} ${sqlOperator} $${nextIndex()}`);
        params.push(filterValue);
        break;
      }

      case "between":
      case "not_between": {
        const range = filterValue as FilterRangeValue | null;
        if (!range || range.from == null || range.to == null) break;
        const notPrefix = filterOperator === "not_between" ? "NOT " : "";
        const fromIndex = nextIndex();
        params.push(range.from);
        const toIndex = nextIndex();
        params.push(range.to);
        conditions.push(`${notPrefix}${filterKey} BETWEEN $${fromIndex} AND $${toIndex}`);
        break;
      }

      default: {
        throw new Error(
          `[buildWhereClause] Operator "${filterOperator}" belum didukung. ` +
            `Tambahkan penanganannya di builders/sql.ts.`
        );
      }
    }
  }

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}
