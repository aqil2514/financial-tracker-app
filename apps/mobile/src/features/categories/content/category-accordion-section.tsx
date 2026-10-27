import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge } from "@/components/badge";
import { CategorySection } from "../utils/group-by-parent";
import { CategoryListItem } from "./category-list-item";
import { CategoryStatusDot } from "./category-status-dot";

const TYPE_LABEL = {
  income: "Pemasukan",
  expense: "Pengeluaran",
};

export function CategoryAccordionSection({
  section,
  onToggleActive,
}: {
  section: CategorySection;
  onToggleActive: (id: string, nextIsActive: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { categoryId } = section;

  const headerPress = section.isStandalone
    ? categoryId != null
      ? () => router.push({ pathname: "/categories/[id]/edit", params: { id: categoryId } })
      : undefined
    : () => setOpen((prev) => !prev);

  return (
    <View className="overflow-hidden rounded-lg border border-neutral-200">
      <Pressable className="flex-row items-center justify-between bg-white px-3 py-3" onPress={headerPress}>
        <View className="flex-row items-center gap-2">
          {categoryId != null ? (
            <CategoryStatusDot
              isActive={section.isActive}
              onToggle={() => onToggleActive(categoryId, !section.isActive)}
            />
          ) : (
            <View className={`size-2.5 shrink-0 rounded-full bg-emerald-500`} />
          )}
          <Text className="font-semibold text-neutral-900">{section.title}</Text>
          <Badge label={TYPE_LABEL[section.type]} variant={section.type} />
        </View>
        <View className="flex-row items-center gap-3">
          {!section.isStandalone && categoryId != null && (
            <Pressable
              hitSlop={10}
              onPress={() =>
                router.push({ pathname: "/categories/[id]/edit", params: { id: categoryId } })
              }
            >
              <Ionicons name="pencil-outline" size={16} color="#737373" />
            </Pressable>
          )}
          {!section.isStandalone && (
            <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color="#737373" />
          )}
        </View>
      </Pressable>

      {open && !section.isStandalone && (
        <View className="gap-2 border-t border-neutral-100 bg-neutral-50 p-2">
          {section.data.map((item) => (
            <CategoryListItem key={item.id} category={item} onToggleActive={onToggleActive} />
          ))}
        </View>
      )}
    </View>
  );
}
