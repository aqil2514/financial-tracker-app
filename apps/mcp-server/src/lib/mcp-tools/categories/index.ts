import type { McpServer } from "@modelcontextprotocol/server";
import { registerCreateCategory } from "./create-category";
import { registerUpdateCategory } from "./update-category";
import { registerDeleteCategory } from "./delete-category";

export function registerCategoriesMcpTools(server: McpServer) {
  registerCreateCategory(server);
  registerUpdateCategory(server);
  registerDeleteCategory(server);
}
