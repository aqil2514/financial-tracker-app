import { QueryState } from "@/components/query-state";
import { CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccountsList } from "../accounts-context";
import { AccountListContentItem } from "./item";

export function AccountListContent() {
  const { error, isLoading } = useAccountsList();
  return (
    <CardContent>
      <QueryState isLoading={isLoading} error={error} />
      <ScrollArea className="h-[480px]">
        <div className="space-y-3 pr-4">
          <AccountListContentItem />
        </div>
      </ScrollArea>
    </CardContent>
  );
}
