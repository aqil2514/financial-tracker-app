import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge } from "@/components/badge";
import { CategorySection } from "../utils/group-by-parent";
import { CategoryListItem } from "./category-list-item";
import { CategoryStatusDot } from "./category-status-dot";

const TYPE_LABEL = {
  income: "Pemasukan",
  expense: "Pengeluaran",
};

export function CategoryAccordionSection({ section }: { section: CategorySection }) {
  const [open, setOpen] = useState(false);

  return (
    <View className="overflow-hidden rounded-lg border border-neutral-200">
      <Pressable
        className="flex-row items-center justify-between bg-white px-3 py-3"
        onPress={section.isStandalone ? undefined : () => setOpen((prev) => !prev)}
      >
        <View className="flex-row items-center gap-2">
          <CategoryStatusDot isActive={section.isActive} />
          <Text className="font-semibold text-neutral-900">{section.title}</Text>
          <Badge label={TYPE_LABEL[section.type]} variant={section.type} />
        </View>
        {!section.isStandalone && (
          <Ionicons
            name={open ? "chevron-up" : "chevron-down"}
            size={18}
            color="#737373"
          />
        )}
      </Pressable>

      {open && !section.isStandalone && (
        <View className="gap-2 border-t border-neutral-100 bg-neutral-50 p-2">
          {section.data.map((item) => (
            <CategoryListItem key={item.id} category={item} />
          ))}
        </View>
      )}
    </View>
  );
}
