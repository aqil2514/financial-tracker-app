export type Pagination = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export function toPagination(total: number, page: number, limit: number): Pagination {
  return {
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
