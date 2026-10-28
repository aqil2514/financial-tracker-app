import { createElement } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { formatCurrency } from "@/lib/utils";
import { resolveAccountIcon } from "@/lib/account-icons";
import { resolveAccountColorHex } from "@/lib/account-colors";
import { AccountListItem as AccountListItemType } from "../types";
import { AccountStatusDot } from "./account-status-dot";

export function AccountListItem({
  account,
  onToggleActive,
}: {
  account: AccountListItemType;
  onToggleActive: (id: string, nextIsActive: boolean) => void;
}) {
  const router = useRouter();

  return (
    <Pressable
      className="flex-row items-center justify-between rounded-lg border border-neutral-200 bg-white p-3"
      onPress={() => router.push({ pathname: "/accounts/[id]/edit", params: { id: account.id } })}
    >
      <View className="flex-row items-center gap-2">
        <AccountStatusDot
          isActive={account.isActive}
          onToggle={() => onToggleActive(account.id, !account.isActive)}
        />
        {createElement(resolveAccountIcon(account.icon), {
          size: 18,
          color: resolveAccountColorHex(account.color),
        })}
        <Text className="font-medium text-neutral-900">{account.name}</Text>
      </View>
      <Text className="font-medium text-neutral-900">{formatCurrency(account.balance)}</Text>
    </Pressable>
  );
}
