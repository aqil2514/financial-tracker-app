import { Stack, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AccountList } from "@/features/accounts/content/account-list";
import { useAccounts } from "@/features/accounts/content/use-accounts";

export default function AccountsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { accounts, isLoading, toggleActive } = useAccounts();

  return (
    <>
      <Stack.Screen options={{ title: "Akun" }} />
      <View className="flex-1 bg-white">
        <AccountList
          accounts={accounts}
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
