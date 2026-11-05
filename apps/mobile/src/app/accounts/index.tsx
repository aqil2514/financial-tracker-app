import { useMemo, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { Pressable, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccountList } from "@/features/accounts/content/account-list";
import { useAccounts } from "@/features/accounts/content/use-accounts";

export default function AccountsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { accounts, isLoading, toggleActive } = useAccounts();
  const [showInactive, setShowInactive] = useState(false);

  const inactiveCount = useMemo(() => accounts.filter((account) => !account.isActive).length, [accounts]);
  const visibleAccounts = useMemo(
    () => (showInactive ? accounts : accounts.filter((account) => account.isActive)),
    [accounts, showInactive]
  );

  return (
    <>
      <Stack.Screen options={{ title: "Akun" }} />
      <View className="flex-1 bg-white">
        <View className="flex-row items-center justify-between border-b border-neutral-100 px-4 py-2">
          <Text className="text-sm text-neutral-700">
            Tampilkan akun nonaktif{inactiveCount > 0 ? ` (${inactiveCount})` : ""}
          </Text>
          <Switch value={showInactive} onValueChange={setShowInactive} />
        </View>

        <AccountList
          accounts={visibleAccounts}
          emptyMessage={accounts.length > 0 ? "Tidak ada akun aktif." : undefined}
          isLoading={isLoading}
          onToggleActive={toggleActive}
          onEditGroup={(groupId) =>
            router.push({ pathname: "/accounts/group/[id]/edit", params: { id: groupId } })
          }
        />

        <Pressable
          className="absolute right-5 size-14 items-center justify-center rounded-full bg-neutral-900 shadow-lg"
          style={{ bottom: insets.bottom + 20 }}
          onPress={() => router.push("/accounts/new")}
        >
          <Text className="text-2xl text-white">+</Text>
        </Pressable>
      </View>
    </>
  );
}
