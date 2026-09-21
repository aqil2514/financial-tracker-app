import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

/** Semua tool Retailku mengembalikan hasilnya sebagai satu block teks
 * berisi JSON (bukan objek terstruktur MCP sendiri) — helper generik
 * untuk parse `content[0].text`, dipakai semua fungsi `get*` di folder
 * ini supaya tidak duplikasi logic parsing. */
export async function callToolAsJson<T>(
  client: Client,
  name: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const result = await client.callTool({ name, arguments: args });
  const firstBlock = Array.isArray(result.content) ? result.content[0] : undefined;
  if (!firstBlock || firstBlock.type !== "text") {
    throw new Error(`Respons ${name} tidak sesuai format yang diharapkan.`);
  }

  const jsonResult = JSON.parse(firstBlock.text) as T;
  return jsonResult
}
