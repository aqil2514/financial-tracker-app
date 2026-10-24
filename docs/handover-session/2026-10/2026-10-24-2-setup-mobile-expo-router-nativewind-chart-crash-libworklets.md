# Handover — 2026-10-24 (sesi 2)

Sesi belajar + setup awal `apps/mobile` dari nol (user masih awam React Native). Dimulai dari dasar React Native/komponen, lanjut Expo Router, NativeWind, React Hook Form + Zod, lalu macet panjang di percobaan menambahkan chart karena masalah native build yang belum terpecahkan. **Belum di-commit** — semua perubahan masih di working tree.

## Yang SUDAH berhasil dan aman dipakai

### Struktur routing — Expo Router, 4 tab
`app/` tetap di root (bukan `src/app`, keputusan sadar user setelah dijelaskan trade-off — lihat Catatan proses). Struktur:
- `app/_layout.tsx` — root `Stack`, wrap `GestureHandlerRootView`, import `global.css`
- `app/(tabs)/_layout.tsx` — `Tabs` dengan 4 screen + icon `@expo/vector-icons` (Ionicons)
- `app/(tabs)/index.tsx` — tab Home (**ini yang jadi masalah**, lihat bagian chart di bawah)
- `app/(tabs)/transactions.tsx` — tab Transaksi, form lengkap `react-hook-form` + `zod` + `Controller`, pakai komponen `Button` dari `src/components/`
- `app/(tabs)/reports.tsx` — tab Laporan, masih placeholder
- `app/(tabs)/more.tsx` — tab Lainnya, list menu (Investasi, Dana Pihak Ketiga, Utang Piutang, Master Data, Retailku, Settings) — menu sekunder yang tidak cukup tempat di bottom tabs, `onPress` masih kosong

Penamaan file & identifier kode pakai bahasa Inggris (`transactions.tsx`, `TransactionsScreen`, `formatCurrency`) sesuai permintaan eksplisit user; teks yang tampil ke pengguna (judul, label menu, pesan error) tetap bahasa Indonesia.

### `src/` untuk kode generic (non-routing)
Alias `@/*` → `./src/*` di `tsconfig.json` `paths` — **TypeScript** otomatis paham ini, tapi **Metro runtime TIDAK** otomatis baca `tsconfig.json paths`. Harus ditambah manual di `metro.config.js`:
```js
config.resolver.extraNodeModules = { '@': path.resolve(projectRoot, 'src') };
```
Isi sekarang: `src/components/Button.tsx` (reusable, dipakai di form transaksi), `src/utils/formatCurrency.ts`.

### NativeWind (Tailwind di React Native)
Setup lengkap: `tailwind.config.js` (`content` harus include `./src/**` juga, bukan cuma `./app/**` — sempat lupa, styling `Button` dari `src/` tidak ke-apply sampai ditambahkan), `global.css`, `babel.config.js` (preset `nativewind/babel` + `jsxImportSource: 'nativewind'`), `metro.config.js` di-wrap `withNativeWind`. Perubahan babel/metro config **wajib** restart dev server dari nol (`--clear`), bukan cuma hot reload.

### Monorepo + Metro resolver custom
`metro.config.js` punya `watchFolders`/`nodeModulesPaths` custom untuk resolve hoisted `node_modules` di root monorepo (npm workspaces). Juga `config.resolver.unstable_enablePackageExports = false` — ini ditambahkan untuk mengatasi error resolusi `d3-zoom` (dependency `victory-native`, SEKARANG SUDAH TIDAK RELEVAN karena `victory-native` sudah dihapus, tapi baris ini dibiarkan, tidak merusak apa pun).

### EAS Build — infrastruktur sudah siap pakai
Akun Expo dibuat (`aqil2514`), project EAS `@aqil2514/mobile` (projectId `9dfd3794-2cf6-4b96-b3b3-283c4ea6add6`) sudah di-link di `app.json` → `extra.eas.projectId`. `eas.json` punya 3 profile (`development` pakai `developmentClient: true` + `buildType: apk`, `preview`, `production`). `expo-dev-client` sudah terinstall. Script `build:mobile` ada di `apps/mobile/package.json` dan di-passthrough dari root `package.json`.

**Development build APK terakhir yang ter-install di HP** (Infinix X6837, Android 13/API 33, `arm64-v8a`, page size 4096): build `2f630f9b-9de1-4658-9936-01bc4b8de19b` — **APK ini CRASH saat buka tab Home** (lihat bagian berikutnya). Build sebelumnya yang juga crash sama: `41518132-9ab5-460b-b3d4-a5092a0e06ef`.

## MASALAH BELUM SELESAI — chart crash `libworklets.so`

### Gejala
App crash tiap kali membuka tab Home (yang berisi `BarChart` dari `react-native-gifted-charts`), error:
```
[runtime not ready]: Error: Exception in HostFunction: java.lang.NoClassDefFoundError:
expo.modules.adapters.react.FabricComponentsRegistry
...
Caused by: com.facebook.soloader.SoLoaderDSONotFoundError: couldn't find DSO to load: libworklets.so
```

### Riwayat chart library (PENTING untuk konteks)
1. **`victory-native`** dicoba pertama — gagal karena bug di `peerDependencies`-nya sendiri: dia menulis `"react-native-skia"` (tanpa scope) padahal package aslinya `@shopify/react-native-skia`. npm resolve `react-native-skia` sebagai package BERBEDA (legacy, versi `2.15.1`, repo `wcandillon/react-native-skia`) — menyebabkan 2 copy Skia ter-install, CMake bentrok (`CMake Error: binary directory already used`), lalu setelah itu teratasi (via `npm overrides` alias), DexMerger bentrok juga (`Type ... SkiaPictureViewManagerDelegate is defined multiple times`).
2. **Diputuskan ganti ke `react-native-gifted-charts`** (berbasis `react-native-svg`, bukan Skia) — `victory-native` dan `@shopify/react-native-skia` SUDAH DIHAPUS dari `apps/mobile/package.json`. Override `react-native-skia` di root `package.json` juga SUDAH DIHAPUS (sempat ditambah lalu dicabut lagi).
3. Setelah ganti ke `gifted-charts`, build EAS sukses (`41518132`) — **TAPI tetap crash** dengan error `libworklets.so` yang SAMA PERSIS seperti sebelumnya, bukan error Skia lagi.

### Root cause SEBENARNYA (ditemukan lewat `adb logcat` + extract APK manual)
`react-native-worklets` (dependency wajib `react-native-reanimated`, versi `0.8.3`) di-compile jadi `libworklets.so` — file ini **ADA secara fisik** di semua APK yang diperiksa (dicek pakai `unzip -l` dan `file` command, ukuran ~3.3MB, ada di keempat arsitektur). Tapi SoLoader (Android, bagian dari React Native) **gagal memuatnya saat runtime** meski filenya ada — gejala klasik mismatch binary/native linking, BUKAN file hilang.

Investigasi NDK (riwayat lengkap, supaya sesi berikutnya tidak mengulang):
- NDK default awal project: **27.1.12297006** — ini yang menyebabkan error linker `-fuse-ld=gold` saat build LOKAL (`expo run:android` di Windows), karena NDK r27+ menghapus dukungan linker `gold`.
- Sempat override manual `ext.ndkVersion = "30.0.14904198"` di `android/build.gradle` LOKAL (file auto-generated, akan ketimpa `prebuild --clean`) — berhasil hindari error linker `gold` di build lokal, TAPI build lokal tetap gagal di tahap lain (CMake Skia conflict, waktu itu masih pakai victory-native).
- Pindah ke **EAS Build (cloud)** karena build lokal Windows terus bermasalah (3 masalah native berbeda berturut-turut: Gradle 9.3.1 bug `JvmVendorSpec.IBM_SEMERU`, linker gold NDK 27, lalu CMake Skia conflict).
- Ditemukan: `react-native-worklets`'s `libworklets.so` di APK EAS **built by NDK r30-beta1** (dicek via `file` command di `.so` yang di-extract) — padahal `app.json` SEMPAT di-set `ndkVersion: "28.2.13676358"` (solusi resmi dari issue GitHub `software-mansion/react-native-reanimated#8730`, ditutup lewat PR#8994 yang bump NDK ke `28.2.13676358` khusus untuk masalah `libworklets.so` + "16kb page size support"). **Setting NDK 28 ini TIDAK TERBUKTI diterapkan ke compile `libworklets.so` di server EAS**, meski `expo config` lokal dan `eas-cli fingerprint:generate` MENGKONFIRMASI fingerprint berubah sesuai config baru. Build dengan NDK 28 tetap crash sama persis — DSO masih dilaporkan built by NDK r30-beta1.
- **Belum ditemukan kenapa** setting `app.json` `android.ndkVersion` tidak konsisten diterapkan ke semua native module (khususnya `react-native-worklets`) di server EAS Build.

### Hal yang SUDAH dibuktikan BUKAN penyebabnya
- **Bukan masalah arsitektur CPU** — HP (`arm64-v8a`) cocok dengan build target EAS.
- **Bukan APK yang stale/salah install** — dicek `pm path` dua kali, package hash APK berbeda tiap install, konfirmasi APK baru benar-benar ter-pasang.
- **Bukan fingerprint mismatch biasa** — sempat salah duga soal ini (`eas-cli fingerprint:compare` dipakai untuk verifikasi, hasilnya cuma beda di `package.json` scripts yang tidak relevan ke native, BUKAN dependency).
- **Reanimated/worklets TIDAK BISA dihapus** sebagai workaround — `npm ls react-native-reanimated --all` membuktikan `expo-router` (transisi) DAN `nativewind`/`react-native-css-interop` (styling dinamis) PAKAI LANGSUNG `react-native-reanimated`. Menghapusnya akan merusak routing dan seluruh styling Tailwind yang sudah dipakai di app.

### Opsi lanjutan yang BELUM dicoba (untuk sesi berikutnya)
1. **Cek apakah APK PALING PERTAMA (`41518132`, dibuild sebelum semua drama NDK dimulai) juga crash sama** — user curiga timing-nya terkait penambahan chart, tapi saya (sesi ini) belum sempat verifikasi dengan reinstall APK itu balik ke HP untuk dites ulang. Ini test termurah sebelum coba apa pun lagi: kalau APK pertama itu JUGA crash sama, berarti bukan soal NDK sama sekali, dan kemungkinan besar bug ini sudah ada SEJAK `react-native-reanimated`+`expo-router` awal diinstall (sebelum chart apa pun disentuh) — artinya investigasi NDK selama ini kemungkinan salah arah total.
2. Coba **upgrade `react-native-reanimated`/`react-native-worklets`** ke versi lebih baru dari `4.3.1`/`0.8.3` (issue GitHub yang jadi rujukan solusi NDK 28 itu closed lewat PR yang juga bump versi reanimated-nya sendiri, bukan cuma NDK — belum dicek versi reanimated berapa yang benar-benar fix).
3. Upgrade **Expo SDK 56 → 57** — `expo doctor` sendiri sudah menyarankan ini untuk alasan BERBEDA (Hermes V1 memory regression), tapi SDK 57 kemungkinan juga bawa versi reanimated/RN yang lebih baru dan mungkin ikut menyelesaikan masalah worklets ini sebagai efek samping.
4. Laporkan sebagai issue baru ke `software-mansion/react-native-reanimated` di GitHub dengan detail lengkap yang sudah dikumpulkan sesi ini (NDK version mismatch terbukti via `file` command di `.so`, padahal `app.json` sudah benar) — bisa jadi bug spesifik Expo SDK 56 + EAS Build image, bukan reanimated semata.

## Keputusan desain yang BELUM final / perlu diingat
- `app.json` `android.ndkVersion` saat ini masih `"28.2.13676358"` (TIDAK terbukti efektif, tapi juga tidak merusak apa pun — aman dibiarkan atau dihapus di sesi berikutnya tergantung arah investigasi lanjutan).
- `expo-build-properties` plugin TERINSTALL tapi config `ndkVersion` di dalamnya (percobaan PERTAMA sebelum tahu field itu salah tempat) SUDAH DIHAPUS — plugin itu sendiri dibiarkan di `plugins` array `app.json` tanpa config apa pun, tidak masalah.
- `gradle-wrapper.properties` LOKAL (`android/gradle/wrapper/`) sempat diubah manual ke Gradle `8.13` (dari default `9.3.1` yang buggy) — ini file auto-generated, akan ketimpa balik ke `9.3.1` tiap `expo prebuild --clean`. Tidak relevan lagi untuk build EAS (server EAS pakai Gradle versi sendiri, bukan baca file lokal ini), hanya relevan kalau user kembali coba build lokal.

## Catatan proses (feedback untuk sesi berikutnya)

- **User menegaskan pola komunikasi**: minta penjelasan konsep dulu sebelum eksekusi (src/ vs app/, NDK, dsb), dan beberapa kali MENOLAK kesimpulan saya yang terlalu cepat/salah — misal soal "APK sudah tidak sinkron karena fingerprint beda" (ternyata cuma beda script, bukan native), dan soal "hapus reanimated untuk hindari worklets" (ternyata reanimated dipakai expo-router+nativewind, tidak bisa dihapus). **Selalu verifikasi dengan bukti konkret (fingerprint compare, `npm ls --all`, extract `.so` dari APK) sebelum menyimpulkan root cause** — jangan asumsi dari nama error semata.
- **User eksplisit tidak suka saya langsung build ulang (15-20 menit) tanpa kepastian** — setelah 4-5x build gagal dengan teori berbeda-beda, user menginterupsi dan bertanya "apa benar solusinya build ulang?". Pelajaran: untuk masalah native/build yang mahal (lama + buang kuota EAS gratis), verifikasi teori dulu dengan cara murah (fingerprint, config check, extract APK) SEBELUM trigger build penuh.
- **User punya 1 device fisik untuk testing** (Infinix X6837, Android 13) tersambung USB kadang tidak stabil (beberapa kali status `offline`/`unauthorized`, perlu `adb kill-server && adb start-server` dan re-approve USB debugging di HP). Build 248MB APK development — ini NORMAL (bukan tanda ada yang salah), production APK akan jauh lebih kecil.
- **Tidak perlu USB untuk EAS Build cloud maupun untuk development sehari-hari setelah APK ter-install** — USB cuma relevan untuk (a) build LOKAL (`expo run:android`), (b) narik APK via `adb pull` untuk diagnosa manual seperti yang dilakukan sesi ini. Development sehari-hari (hot reload) pakai WiFi, HP dan laptop harus 1 jaringan.
- Tools ELF analysis (`readelf`, `objdump`, `nm`) **TIDAK TERSEDIA** di environment Bash/Git-Bash user — kalau perlu inspeksi `.so` lebih dalam di sesi berikutnya (misal cek unresolved symbol), perlu cari cara lain (WSL, atau install via `AndroidSdk/ndk/<version>/toolchains/llvm/prebuilt/windows-x86_64/bin/llvm-readelf.exe` yang kemungkinan sudah ada dari NDK yang ter-install).
