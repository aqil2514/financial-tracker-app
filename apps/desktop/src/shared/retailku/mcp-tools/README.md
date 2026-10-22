# `mcp-tools`

Pemanggilan tool MCP Retailku spesifik (`get_cashflow_detail`, `get_ar_ap`, `get_fund_transfer_list`, dst). Buka koneksinya sendiri (`connectRetailkuMcp`) ada di `../mcp-connection/`.

## `call-tool-as-json.ts`

Semua tool Retailku mengembalikan hasilnya sebagai satu block teks berisi JSON (bukan objek terstruktur MCP sendiri) — `callToolAsJson` adalah helper generik untuk parse `content[0].text`, dipakai semua fungsi `get*` di folder ini supaya tidak duplikasi logic parsing.
