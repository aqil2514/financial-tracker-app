import type { McpServer } from "@modelcontextprotocol/server";
import { registerCreateContact } from "./create-contact";
import { registerUpdateContact } from "./update-contact";
import { registerDeleteContact } from "./delete-contact";
import { registerGetContactHistory } from "./get-contact-history";

export function registerContactsMcpTools(server: McpServer) {
  registerCreateContact(server);
  registerUpdateContact(server);
  registerDeleteContact(server);
  registerGetContactHistory(server);
}
