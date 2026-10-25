import { useEffect, type ReactNode } from "react";
import {
  useForm,
  FormProvider,
  type DefaultValues,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType } from "zod";
import { Pressable, Text, View } from "react-native";

interface BaseFormProps<TInput extends FieldValues, TOutput> {
  schema: ZodType<TOutput, TInput>;
  defaultValues: DefaultValues<TInput>;
  onSubmit: (values: TOutput) => void;
  isPending: boolean;
  submitLabel?: string;
  children: (form: UseFormReturn<TInput, unknown, TOutput>) => ReactNode;
}

export function BaseForm<TInput extends FieldValues, TOutput>({
  schema,
  defaultValues,
  onSubmit,
  isPending,
  submitLabel = "Simpan",
  children,
}: BaseFormProps<TInput, TOutput>) {
  const form = useForm<TInput, unknown, TOutput>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues]);

  const submit = form.handleSubmit(onSubmit);

  return (
    <FormProvider {...form}>
      <View className="gap-4">
        {children(form)}
        <View className="flex-row justify-end border-t border-neutral-200 pt-3">
          <Pressable
            className="items-center rounded-md bg-neutral-900 px-4 py-3 disabled:opacity-50"
            disabled={isPending}
            onPress={() => submit()}
          >
            <Text className="font-medium text-white">
              {isPending ? "Menyimpan..." : submitLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </FormProvider>
  );
}
