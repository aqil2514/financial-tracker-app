import type { McpServer } from "@modelcontextprotocol/server";
import { registerListCategories } from "./list-categories";
import { registerCreateCategory } from "./create-category";
import { registerUpdateCategory } from "./update-category";
import { registerDeleteCategory } from "./delete-category";

export function registerCategoriesMcpTools(server: McpServer) {
  registerListCategories(server);
  registerCreateCategory(server);
  registerUpdateCategory(server);
  registerDeleteCategory(server);
}
