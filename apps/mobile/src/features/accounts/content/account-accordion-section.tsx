import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@/lib/utils";
import { AccountGroupSection } from "../utils/group-by-account-group";
import { AccountListItem } from "./account-list-item";

export function AccountAccordionSection({
  section,
  onToggleActive,
  onEditGroup,
}: {
  section: AccountGroupSection;
  onToggleActive: (id: string, nextIsActive: boolean) => void;
  onEditGroup: (groupId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const totalBalance = section.data.reduce((sum, account) => sum + account.balance, 0);

  return (
    <View className="overflow-hidden rounded-lg border border-neutral-200">
      <Pressable
        className="flex-row items-center justify-between bg-neutral-50 px-3 py-3"
        onPress={() => setOpen((prev) => !prev)}
      >
        <Text className="font-semibold text-neutral-900">{section.title}</Text>
        <View className="flex-row items-center gap-3">
          <Text className="font-medium text-neutral-700">{formatCurrency(totalBalance)}</Text>
          {section.groupId != null && (
            <Pressable hitSlop={10} onPress={() => onEditGroup(section.groupId!)}>
              <Ionicons name="pencil-outline" size={16} color="#737373" />
            </Pressable>
          )}
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color="#737373" />
        </View>
      </Pressable>

      {open && (
        <View className="gap-2 border-t border-neutral-100 bg-neutral-50 p-2">
          {section.data.map((account) => (
            <AccountListItem key={account.id} account={account} onToggleActive={onToggleActive} />
          ))}
        </View>
      )}
    </View>
  );
}
