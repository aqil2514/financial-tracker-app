import { FlatList, Text, View } from "react-native";
import { AccountListItem as AccountListItemType } from "../types";
import { groupByAccountGroup } from "../utils/group-by-account-group";
import { AccountAccordionSection } from "./account-accordion-section";

interface AccountListProps {
  accounts: AccountListItemType[];
  isLoading: boolean;
  onToggleActive: (id: string, nextIsActive: boolean) => void;
  onEditGroup: (groupId: string) => void;
}

export function AccountList({ accounts, isLoading, onToggleActive, onEditGroup }: AccountListProps) {
  const sections = groupByAccountGroup(accounts);

  if (!isLoading && accounts.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-4">
        <Text className="text-neutral-500">Belum ada akun.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={sections}
      keyExtractor={(section) => section.id}
      contentContainerClassName="gap-2 px-4 pb-20 pt-4"
      renderItem={({ item: section }) => (
        <AccountAccordionSection
          section={section}
          onToggleActive={onToggleActive}
          onEditGroup={onEditGroup}
        />
      )}
    />
  );
}
