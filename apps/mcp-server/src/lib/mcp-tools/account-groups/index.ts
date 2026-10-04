import type { McpServer } from "@modelcontextprotocol/server";
import { registerCreateAccountGroup } from "./create-account-group";
import { registerUpdateAccountGroup } from "./update-account-group";
import { registerDeleteAccountGroup } from "./delete-account-group";

export function registerAccountGroupsMcpTools(server: McpServer) {
  registerCreateAccountGroup(server);
  registerUpdateAccountGroup(server);
  registerDeleteAccountGroup(server);
}
