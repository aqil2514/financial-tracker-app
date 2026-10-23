# `types/tools`

Type hasil respons tiap tool MCP Retailku (`../../helpers/tools/` berisi fungsinya saja). Satu file per tool, nama file sama dengan nama tool (`get_cash_opname_list.ts` ↔ `get_cash_opname_list`).

## `get_cash_opname_list.ts` / `get_cash_opname_detail.ts`

Type untuk `getCashOpnameList`/`getCashOpnameDetail` — penjelasan domain (apa itu cash opname, arti `netTotal`/`difference`, dll.) ada di `../../helpers/tools/README.md`, bukan di sini.

## `get_purchase_order_list.ts` / `get_purchase_order_detail.ts`

Type untuk `getPurchaseOrderList`/`getPurchaseOrderDetail` — penjelasan domain (struktur `purchasePayments[].lines[]`, dll.) ada di `../../helpers/tools/README.md`.

## `get_direct_purchase_list.ts` / `get_direct_purchase_detail.ts`

Type untuk `getDirectPurchaseList`/`getDirectPurchaseDetail` — penjelasan domain (struktur `paymentLines[]`, `adjustments[]`, dll.) ada di `../../helpers/tools/README.md`.
