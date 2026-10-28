import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { BaseForm } from "@/components/forms/base-form";
import { FormFieldNumber, FormFieldText, FormFieldToggleGroup } from "@/components/forms/form-fields";
import { accountFormSchema, type AccountFormOutput, type AccountFormValues } from "./schema";
import { GroupSelectField } from "./fields/group-select";
import { IconPickerField } from "./fields/icon-picker";
import { ColorPickerField } from "./fields/color-picker";

const KIND_OPTIONS = [
  { value: "account", label: "Akun" },
  { value: "group", label: "Grup Akun" },
];

const ACTIVE_OPTIONS = [
  { value: "true", label: "Aktif" },
  { value: "false", label: "Nonaktif" },
];

export function AccountForm({
  defaultValues,
  onSubmit,
  isPending,
  submitLabel,
  onDelete,
  hideKindToggle,
  inBottomSheet,
}: AccountFormProps) {
  return (
    <BaseForm
      schema={accountFormSchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      isPending={isPending}
      submitLabel={submitLabel}
      renderFooter={
        onDelete
          ? (submit) => (
              <View className="flex-row items-center justify-end gap-2 border-t border-neutral-200 pt-3">
                <Pressable
                  className="flex-row items-center gap-1.5 rounded-md border border-red-200 px-4 py-3"
                  onPress={onDelete}
                >
                  <Ionicons name="trash-outline" size={18} color="#dc2626" />
                  <Text className="font-medium text-red-600">Hapus</Text>
                </Pressable>
                <Pressable
                  className="flex-row items-center gap-1.5 rounded-md bg-neutral-900 px-4 py-3 disabled:opacity-50"
                  disabled={isPending}
                  onPress={submit}
                >
                  <Ionicons name="checkmark-outline" size={18} color="white" />
                  <Text className="font-medium text-white">
                    {isPending ? "Menyimpan..." : (submitLabel ?? "Simpan")}
                  </Text>
                </Pressable>
              </View>
            )
          : undefined
      }
    >
      {(form) => (
        <AccountFormFields form={form} hideKindToggle={hideKindToggle} inBottomSheet={inBottomSheet} />
      )}
    </BaseForm>
  );
}

interface AccountFormProps {
  defaultValues: AccountFormValues;
  onSubmit: (values: AccountFormOutput) => void;
  isPending: boolean;
  submitLabel?: string;
  onDelete?: () => void;
  hideKindToggle?: boolean;
  // Field teks di sini pakai TextInput biasa secara default, yang
  // tidak ter-track oleh sistem keyboard-avoidance @gorhom/bottom-sheet
  // (butuh handleOnFocus/handleOnBlur manual) — set true kalau form ini
  // dirender di dalam BottomSheetModal/BottomSheetScrollView supaya
  // field teks pakai BottomSheetTextInput, kalau tidak keyboard
  // menutupi field saat fokus.
  inBottomSheet?: boolean;
}

function AccountFields({
  form,
  inBottomSheet,
}: {
  form: UseFormReturn<AccountFormValues, unknown, AccountFormOutput>;
  inBottomSheet?: boolean;
}) {
  return (
    <>
      <IconPickerField />

      <ColorPickerField />

      <GroupSelectField />

      <FormFieldNumber
        form={form}
        name="initial_balance"
        label="Saldo Awal"
        placeholder="0"
        prefix="Rp"
        grouped
        inBottomSheet={inBottomSheet}
      />

      <FormFieldText
        form={form}
        name="description"
        label="Deskripsi"
        placeholder="Opsional"
        multiline
        inBottomSheet={inBottomSheet}
      />

      <FormFieldToggleGroup
        form={form}
        name="is_active"
        label="Status"
        options={ACTIVE_OPTIONS}
      />
    </>
  );
}

function AccountFormFields({
  form,
  hideKindToggle,
  inBottomSheet,
}: {
  form: UseFormReturn<AccountFormValues, unknown, AccountFormOutput>;
  hideKindToggle?: boolean;
  inBottomSheet?: boolean;
}) {
  const kind = useWatch({ control: form.control, name: "kind" });

  return (
    <>
      {!hideKindToggle && <FormFieldToggleGroup form={form} name="kind" options={KIND_OPTIONS} />}

      <FormFieldText
        form={form}
        name="name"
        label="Nama"
        placeholder={kind === "group" ? "Mis. E-Wallet" : "Mis. Dompet"}
        inBottomSheet={inBottomSheet}
      />

      {kind === "account" && <AccountFields form={form} inBottomSheet={inBottomSheet} />}
    </>
  );
}