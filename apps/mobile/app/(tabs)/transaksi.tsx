import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { z } from 'zod';

const transaksiSchema = z.object({
  nominal: z.string().min(1, 'Nominal wajib diisi'),
  keterangan: z.string().min(1, 'Keterangan wajib diisi'),
});

type TransaksiForm = z.infer<typeof transaksiSchema>;

export default function TransaksiScreen() {
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TransaksiForm>({
    resolver: zodResolver(transaksiSchema),
    defaultValues: { nominal: '', keterangan: '' },
  });

  function onSubmit(data: TransaksiForm) {
    Alert.alert('Transaksi disimpan', `${data.keterangan} - Rp${data.nominal}`);
    reset();
  }

  return (
    <View className="flex-1 bg-white px-6 pt-16">
      <Text className="mb-6 text-2xl font-bold">Tambah Transaksi</Text>

      <View className="mb-4">
        <Text className="mb-1 text-sm font-medium text-gray-700">Nominal</Text>
        <Controller
          control={control}
          name="nominal"
          render={({ field: { value, onChange } }) => (
            <TextInput
              className="rounded-lg border border-gray-300 px-4 py-3 text-base"
              placeholder="0"
              keyboardType="numeric"
              value={value}
              onChangeText={onChange}
            />
          )}
        />
        {errors.nominal && (
          <Text className="mt-1 text-sm text-red-600">
            {errors.nominal.message}
          </Text>
        )}
      </View>

      <View className="mb-6">
        <Text className="mb-1 text-sm font-medium text-gray-700">Keterangan</Text>
        <Controller
          control={control}
          name="keterangan"
          render={({ field: { value, onChange } }) => (
            <TextInput
              className="rounded-lg border border-gray-300 px-4 py-3 text-base"
              placeholder="Misal: Makan siang"
              value={value}
              onChangeText={onChange}
            />
          )}
        />
        {errors.keterangan && (
          <Text className="mt-1 text-sm text-red-600">
            {errors.keterangan.message}
          </Text>
        )}
      </View>

      <Pressable
        className="rounded-lg bg-blue-600 py-3 active:bg-blue-700"
        onPress={handleSubmit(onSubmit)}
      >
        <Text className="text-center text-base font-semibold text-white">
          Simpan
        </Text>
      </Pressable>
    </View>
  );
}
