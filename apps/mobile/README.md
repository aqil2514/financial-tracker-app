# Finansial Tracker — Mobile

Versi mobile (Expo/React Native) dari aplikasi pelacak keuangan pribadi. Bagian dari monorepo `financial-app` (`apps/desktop`, `apps/mobile`, `apps/mcp-server`, `apps/worker`). Data tersimpan lokal via SQLite (`expo-sqlite`), tanpa cloud sync — murni on-device.

## Menjalankan secara lokal

1. Install dependencies dari root monorepo:

   ```bash
   npm install
   ```

2. Jalankan dev server dari folder ini:

   ```bash
   npx expo start
   ```

Karena project sudah memakai beberapa native module (`expo-sqlite`, `expo-file-system`, `expo-image-picker`, `expo-document-picker`, `react-native-keyboard-controller`, `@gorhom/bottom-sheet`, dll), app ini **tidak bisa dijalankan di Expo Go**. Gunakan [development build](https://docs.expo.dev/develop/development-builds/introduction/):

```bash
npx expo run:android   # atau
npx expo run:ios
```

## Struktur folder (`src/`)

- `app/` — routing berbasis file (Expo Router). Setiap file = satu screen, `_layout.tsx` = navigator.
- `components/` — komponen UI yang dipakai lintas fitur (termasuk `components/forms/` — field-field form generik).
- `features/` — logika per-fitur (mis. `features/transactions/`).
- `shared/` — util/hook yang dipakai lintas fitur (mis. `shared/attachments/`).
- `lib/` — setup database (migrasi SQLite) dan util inti lainnya.
- `constants/` — nilai konstan lintas app.

## Build APK

- **EAS Build** (`npm run build:development` / `build:preview` / `build:production`) — build di cloud Expo, tapi free tier EAS punya limit build bulanan.
- **GitHub Actions** (`.github/workflows/build-mobile-apk.yml`) — build APK debug self-hosted di runner GitHub (tanpa memotong kuota EAS), lewat `expo prebuild` + Gradle langsung. Trigger manual lewat tab Actions → "Build Mobile APK (Debug)" → Run workflow. Hasil APK bisa diunduh dari Artifacts run tersebut.

## Perintah penting

```bash
npx expo lint          # lint
npx tsc --noEmit        # typecheck
npx expo-doctor         # diagnosa dependency/config
npx expo install <pkg>  # tambah dependency (resolve versi sesuai SDK)
```

Lihat [AGENTS.md](./AGENTS.md) untuk aturan pengembangan lebih detail (CNG, kapan butuh development build, dll).
