# Handover — 2026-10-25 (sesi 1)

Lanjutan investigasi crash `libworklets.so` dari [2026-10-24-2](2026-10-24-2-setup-mobile-expo-router-nativewind-chart-crash-libworklets.md). User sudah setup ulang `apps/mobile` dari nol SEBELUM sesi ini mulai (scaffold baru, bukan hasil kerja sesi ini) — sesi ini isinya investigasi git history, build EAS, dan verifikasi apakah crash lama masih ada di scaffold baru, plus beberapa task kecil (tab navigation, icon, package scripts).

## Status crash `libworklets.so` — KEMUNGKINAN SUDAH TIDAK ADA, TAPI BELUM TERVERIFIKASI PENUH

### Commit yang bermasalah vs yang baru
- `40d531f` "Setup mobile" — basis dari build EAS `2f630f9b-9de1-4658-9936-01bc4b8de19b` dan `41518132-9ab5-460b-b3d4-a5092a0e06ef`, KEDUANYA crash `libworklets.so` (lihat handover 2026-10-24-2). Pakai `react-native-reanimated@4.3.1` + `react-native-worklets@0.8.3`, Expo SDK 56, struktur `app/` di root.
- `98e3199` "Delete apps/mobile untuk setup ulang" — hapus total struktur lama.
- `2576161` "Setup mobile #2" — scaffold baru dari `npx create-expo-app` (bukan dari nol manual seperti sebelumnya). Struktur beda total: `src/app/` (bukan `app/` di root), pakai `NativeTabs` dari `expo-router/native-tabs` (bukan `Tabs` biasa), Expo SDK **58** (naik dari 56), `react-native-reanimated@4.7.1` + `react-native-worklets@0.13.0` (naik dari 4.3.1/0.8.3), `@expo/ui` baru.
- `b61aa45` "Setup to EAS", `cb60c9c` "Update package scripts and icon mobile" — perubahan setelahnya CUMA metadata (`app.json` name/slug/bundleIdentifier/eas.projectId), icon assets, dan script `package.json`. **Tidak ada perubahan dependency** antara `2576161` dan `cb60c9c` (dicek pakai `git diff 2576161 cb60c9c -- apps/mobile/package.json`, section `dependencies` kosong).

### Build EAS `4e2c1d87` (commit `2576161`, profile `production`) — TIDAK CRASH
User build dan install ke HP fisik (Infinix X6837) lewat konversi AAB→APK manual (lihat bagian bundletool di bawah), buka tab Home (masih placeholder polos, BUKAN tab yang ada chart) — **tidak crash**. Ini baseline pertama yang berhasil sejak masalah `libworklets.so` muncul.

**PENTING — ini BELUM reproduksi skenario crash asli.** Tab Home di scaffold baru ini masih placeholder (`<Text>Beranda</Text>`), BELUM ada chart `react-native-gifted-charts` yang jadi pemicu crash original. Jadi "tidak crash" ini baru membuktikan fondasi (expo-router + reanimated + nativewind + worklets versi baru) aman di level dasar, BUKAN membuktikan masalah selesai total. **Next step paling penting: pasang ulang chart di tab Home/Laporan, build lagi, test lagi di HP** — itu baru test yang valid dibanding kasus asli.

Dugaan kenapa mungkin sudah fix: upgrade `react-native-reanimated`/`react-native-worklets` (opsi #2 dari handover sebelumnya) kebetulan tercakup otomatis lewat setup ulang total, BUKAN hasil upgrade sengaja. Belum ada bukti langsung bahwa versi baru ini yang menyelesaikan masalah (vs kemungkinan lain: SDK 58 bawa image/NDK EAS yang beda, dsb) — tidak ada A/B test terkontrol.

### Opsi #1 dari handover lama (tes APK pertama `41518132`) — DIBATALKAN, SUDAH TIDAK RELEVAN
Sempat mau dicoba di awal sesi ini, tapi dibatalkan begitu ketahuan `apps/mobile` sudah di-setup ulang total — APK `41518132` itu dari kode yang sudah tidak ada sama sekali di repo. Test yang lebih relevan sekarang adalah pasang chart lagi di scaffold baru (lihat atas), bukan APK lama.

## Temuan baru — image EAS Build tidak di-pin (`auto`)

Ditemukan lewat diskusi "bagaimana memastikan lokal = prod": `eas.json` TIDAK pin field `image` di profile mana pun, jadi semua build pakai alias `auto` (image dipilih otomatis berdasarkan project config/SDK/RN version). Nama image EAS Build itu sendiri MENGANDUNG versi NDK (contoh: `ubuntu-26.04-jdk-17-ndk-r27b-sdk-58`) — artinya versi NDK yang dipakai compile `.so` ditentukan OLEH IMAGE, bukan murni dari `app.json` → `android.ndkVersion`.

Ini kandidat penjelasan kuat untuk misteri yang BELUM terpecahkan di handover sebelumnya: kenapa `app.json` `ndkVersion: "28.2.13676358"` "tidak terbukti diterapkan" ke compile `libworklets.so` di server EAS (hasil tetap NDK r30-beta1). Belum dicoba pin `image` secara eksplisit untuk verifikasi teori ini — opsi murah untuk sesi berikutnya kalau crash muncul lagi pas chart dipasang ulang.

User eksplisit TIDAK mau ubah `eas.json` sekarang karena ini hasil `eas init` otomatis — dibiarkan apa adanya.

## Keputusan: TETAP monorepo (npm workspaces)

Sempat didiskusikan apakah `apps/mobile` sebaiknya dipisah dari monorepo (hapus `workspaces` di root `package.json`) supaya `node_modules` terisolasi total dan tidak ada duplicate dependency (`expo-doctor` sempat melaporkan `react-native`/`reanimated`/`worklets` versi beda di root vs `apps/mobile/node_modules`, disebabkan oleh dependency transitive `expo-router`/`@expo/ui` yang narik versi lama secara terpisah — BUKAN sisa lama yang belum dibersihkan, sudah dicoba `npm install` ulang di root dan tetap sama).

**Ditunda** — alasan: (1) akan merusak script root (`npm run dev:desktop` dll pakai `--workspace=`) dan CI `.github/workflows/release-desktop.yml` (`npm ci` di root mengasumsikan workspaces aktif, build Tauri desktop akan gagal total kalau dihapus tanpa perbaikan di CI juga), (2) belum terbukti bahwa hoisting ini benar penyebab crash worklets — dugaan tadi mengarah ke image EAS Build, bukan resolusi dependency lokal. Keputusan: jangan korbankan stabilitas CI desktop yang sudah jalan untuk bug yang penyebabnya belum pasti.

## EAS Build credit (Free plan)

Dikonfirmasi dari docs resmi (`docs.expo.dev/billing/plans`): limit **15 Android + 15 iOS build/bulan** di Free plan, **reset bulanan** ("These limits reset monthly" — dikutip langsung). Bukan jatah sekali habis selamanya. Saat dicek di dashboard Usage: sudah terpakai **6 Android, 0 iOS** build bulan ini. Build `production` juga menghasilkan **AAB** (bukan APK) — format wajib Play Store; untuk APK yang bisa langsung `adb install`, harus pakai profile `preview` (`distribution: "internal"`) bukan `production`.

## Cara extract APK dari AAB tanpa build ulang (hemat kuota)

Dipakai untuk test build `4e2c1d87` (yang ternyata profile `production` → AAB) tanpa buang 1 kuota build lagi:
1. Download `bundletool-all-1.18.3.jar` dari GitHub release resmi `google/bundletool`.
2. Download AAB dari EAS (`npx eas-cli build:view <build-id> --json` → field `artifacts.applicationArchiveUrl`).
3. `java -jar bundletool.jar build-apks --bundle=app.aab --output=app.apks --mode=universal` — hasilnya `.apks` (archive), extract `universal.apk` dari situ (`unzip app.apks universal.apk`).
4. **Catatan penting**: APK hasil cara ini di-sign ulang pakai **debug keystore lokal** (`bundletool` tidak punya akses private key production EAS), jadi bukan representasi 100% identik secara signature — tapi cukup valid untuk test fungsional/crash di device.

Untuk build berikutnya, lebih baik langsung pakai profile `preview` (sudah ditambahkan script-nya, lihat bagian bawah) supaya dapat APK langsung tanpa perlu `bundletool` lagi.

## Task kecil yang selesai di sesi ini

### Tab navigation 4-menu (sesuai struktur lama)
`src/app/(tabs)/_layout.tsx` diupdate dari scaffold default (2 tab: index, about) jadi 4 tab: Beranda, Transaksi, Laporan, Lainnya — pakai `NativeTabs.Trigger.Icon` dengan prop `sf` (SF Symbol iOS) + `md` (Material Symbol Android, support state default/selected karena SDK 58+), BUKAN `@expo/vector-icons` seperti struktur lama (sudah tidak relevan untuk `NativeTabs`). File baru (placeholder polos): `transactions.tsx`, `reports.tsx`, `more.tsx`. `about.tsx` dihapus. Referensi: `docs.expo.dev/router/advanced/native-tabs/#icon`.

Folder `example/` (arsip kode contoh dari `scripts/reset-project.js` bawaan template Expo) sengaja DIBIARKAN — bukan bagian app yang jalan (entry point baca `src/app`, bukan `example/src/app`), tapi user mau simpan sebagai referensi. Error `tsc` yang muncul dari folder ini AMAN diabaikan, tidak terkait kode app.

### Icon mobile — disamakan dengan desktop (dompet hijau-hitam)
Semua icon (`icon.png`, `android-icon-foreground/background/monochrome.png`, `splash-icon.png`, `favicon.png`) diganti dari source `apps/desktop/src-tauri/icons/icon.png`, dengan penyesuaian wajib per requirement Expo (`docs.expo.dev/develop/user-interface/app-icons/` + `developer.android.com` adaptive icon guideline):
- `icon.png` & `favicon.png`: background **putih solid** ditambahkan (requirement: tidak boleh ada pixel transparan untuk icon utama), upscale ke 1024×1024.
- `android-icon-foreground.png`: logo dalam **safe zone 58%** dari canvas (safe zone resmi Android: 66/108 ≈ 61%, dipakai 58% untuk margin aman), TRANSPARAN di luar logo (beda dari icon utama — ini layer terpisah dari `android-icon-background.png` yang solid putih).
- `android-icon-monochrome.png`: siluet PUTIH di atas transparan (bukan hitam) — untuk Android 13+ themed icon. Sempat salah generate (hasil pertama cuma kotak putih polos karena bug `joinChannel`/alpha masking) — diperbaiki pakai pendekatan manual raw buffer (ambil alpha channel asli jadi mask, RGB diganti putih).
- Dikerjakan pakai `sharp` (sudah ada hoisted di root `node_modules`, tidak perlu install baru) lewat script sekali-pakai di scratchpad, BUKAN ImageMagick (tidak terinstall; `convert` yang kedetek di PATH itu `C:\WINDOWS\system32\convert.exe`, tool Windows disk convert — bukan ImageMagick, jangan terpanggil tidak sengaja).

`expo-doctor` dicek ulang setelah ganti icon — tidak ada warning baru soal icon (warning duplicate dependency yang sudah ada sebelumnya tetap muncul, tidak terkait).

### Package scripts per-profile EAS
`apps/mobile/package.json`: tambah `build:development`, `build:preview`, `build:production` (sebelumnya cuma ada `build:preview`, format JSON-nya juga sempat kurang spasi). Root `package.json`: tambah `build:mobile-development`, `build:mobile-preview`, `build:mobile-production` (passthrough `--workspace=mobile`), DAN perbaiki `dev:mobile` yang sebelumnya salah nunjuk ke script `dev` (tidak ada di `apps/mobile/package.json`) jadi `start` (yang benar ada).

## Next step paling penting untuk sesi berikutnya

1. **Pasang ulang chart (`react-native-gifted-charts` atau alternatif) di tab Home/Laporan, build pakai profile `preview`, install & test di HP.** Ini satu-satunya test yang benar-benar reproduksi skenario crash original — semua yang sudah dites sejauh ini (tab placeholder) BELUM membuktikan apa-apa soal chart secara spesifik.
2. Kalau crash muncul lagi: coba pin `image` eksplisit di `eas.json` (bukan `auto`) sebagai eksperimen termurah berikutnya, sebelum opsi besar lain (upgrade SDK 57/58 sudah otomatis kepakai, jadi opsi itu sudah "terpakai" — kalau masih crash, lanjut ke laporan issue GitHub upstream seperti direncanakan di handover sebelumnya).
3. Kalau TIDAK crash dengan chart: pertimbangkan pin versi dependency native jadi exact (reanimated/worklets sudah exact, cek yang lain) + pin `image` EAS supaya hasil "berhasil" ini tidak kebetulan/berubah lagi di build berikutnya (lihat diskusi "lokal = prod" — build sukses sekali tidak menjamin build berikutnya sukses kalau image/dependency tidak di-pin).
