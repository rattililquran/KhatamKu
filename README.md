# KhatamKu

Frontend statis untuk aplikasi pelacak bacaan Al-Qur'an.

## Peta project

- `github/` adalah repository frontend yang diterbitkan ke GitHub Pages dari branch `main`.
- `../supabase/` berisi migrasi SQL dan Edge Functions. Folder backend ini berada di luar repository Git frontend; perubahan di sana tidak ikut dalam commit dari `github/`.
- Jalankan perintah Supabase dari root workspace `khatamku/`, yaitu direktori yang berisi folder `supabase/`. Jika dijalankan dari dalam `supabase/`, CLI mencari path fungsi yang keliru.

## Pemeriksaan frontend

```sh
cd github
node --test tests/session-login-regression.test.mjs
git diff --check
```

Tes tersebut mencakup preferensi sesi login, migrasi sesi lama, logout, validasi payload dashboard, dan idempotensi permintaan pencatatan.

## Alur deploy

### 1. Autentikasi CLI

Login Supabase dan GitHub terpisah:

```sh
supabase login
gh auth login
```

Masukkan kredensial hanya di prompt CLI atau credential manager. Jangan menaruh PAT di remote URL, file source, atau chat. Jika kredensial pernah masuk ke URL remote, cabut token tersebut di GitHub lalu pulihkan URL tanpa kredensial:

```sh
git remote set-url origin https://github.com/rattililquran/KhatamKu.git
```

Hindari `git remote -v` jika remote belum dipastikan bersih karena perintah itu dapat menampilkan kredensial yang tertanam.

### 2. Migrasi database

Jalankan dari root `khatamku/`:

```sh
supabase migration list --linked
supabase db push --linked
```

Pastikan daftar lokal dan remote selaras sebelum push. Riwayat database pernah kosong karena migrasi sebelumnya dijalankan manual; pada 2026-10-07 riwayat 0001–0015 direkonsiliasi setelah objeknya diverifikasi, lalu migrasi 0016 diterapkan. Jika riwayat kembali tidak selaras, periksa objek database sebelum memakai `migration repair`.

### 3. Edge Function

Untuk perubahan pada `bridge-portal/index.ts`, jalankan dari root `khatamku/`:

```sh
supabase functions deploy bridge-portal --project-ref afykoejnpkiorqbkgndp --no-verify-jwt
supabase functions list --project-ref afykoejnpkiorqbkgndp
```

`--no-verify-jwt` diperlukan karena function memeriksa JWT sendiri untuk `confirm_link_code` dan shared secret untuk panggilan server-ke-server. `BRIDGE_SHARED_SECRET` harus sudah ada di project KhatamKu dan Portal dengan nilai yang sama; jangan salin nilainya ke catatan atau log.

### 4. Frontend

Dari repository `github/`, jalankan regression test, lalu commit file yang terkait dan push ke `main`. Push memicu workflow **pages build and deployment**. Periksa hasil workflow dan URL GitHub Pages setelah publish.

## Rilis terakhir

- 2026-10-07: Edge Function `bridge-portal` aktif versi 4; `verify_jwt=false`.
- Database memakai migrasi 0001–0016; RPC progres idempotent dan wrapper lama sudah diverifikasi.
- Frontend fix login/pencatatan dipublikasikan dari commit `6d785ce`.
- Regression test: 5 lulus.
