# Standar editorial Potret

Potret adalah tulisan edukasi untuk pembaca KhatamKu. Naskah aktif bawaan berada di [`potret-content.js`](potret-content.js). Tanggal pada kartu adalah tanggal revisi naskah. Lima naskah bawaan direvisi pada 8 Oktober 2026.

## Cara menulis dalil dan analisis

1. **Teks sumber.** Cantumkan surah dan ayat untuk Al-Qur'an. Untuk hadis, cantumkan koleksi, kitab/bab bila tersedia, nomor hadis pada edisi digital yang ditautkan, dan perawi bila penting untuk konteks. Untuk karya ulama, cantumkan penulis, judul, jilid/halaman atau bagian yang dapat ditemukan.
2. **Status sumber.** Bedakan ayat Al-Qur'an, hadis sahih, hadis yang penilaiannya tidak tunggal, penjelasan fikih ulama, dan laporan biografi/atsar. Riwayat biografi tidak dijadikan sabda Nabi atau tuntutan ibadah umum.
3. **Redaksi.** Bila kalimat Indonesia merangkum makna, tulis sebagai parafrasa. Kutipan langsung harus cocok dengan terjemahan yang disebut. Jangan menggabungkan rincian dari dua jalur riwayat menjadi satu kutipan tanpa keterangan.
4. **Penalaran.** Pisahkan apa yang secara eksplisit disebut teks dari pelajaran atau saran redaksi. Hindari angka target, hukum wajib, peringkat tokoh, atau janji hasil yang tidak dinyatakan sumber.
5. **Perbedaan pendapat.** Untuk masalah fikih yang diperselisihkan, jelaskan ruang lingkup pendapat dan sumbernya, atau bahas dalam artikel tersendiri. Anjuran adab tidak otomatis menjadi syarat sah.
6. **Keterlacakan.** Setiap penanda `[n]` dalam isi harus memiliki entri `sumber` dengan nomor sama, sitasi, status, dan tautan HTTPS menuju teks yang dipakai. Periksa ulang tautan dan nomor sebelum menerbitkan revisi.

## Catatan koreksi edisi ini

| Naskah lama | Koreksi berbasis sumber |
| --- | --- |
| Adab: bersuci dari semua hadas dikemas sebagai prasyarat membaca; Muslim 798 dipakai untuk adab tersebut. | Al-Nawawi, *al-Tibyān*, menjelaskan wudu sebelum tilawah sebagai anjuran, dan bacaan lisan saat hadas kecil tetap boleh. Muslim 798a membahas pembaca yang terbata. |
| Ibn Mas‘ud diberi peringkat bacaan “paling dicintai Nabi”. | Bukhari 5055 dan Muslim 800a hanya menyebut Nabi senang mendengar bacaan dari orang lain dan menangis pada an-Nisa 4:41. |
| Imam al-Syafi‘i disebut pasti dua khatam setiap hari, seluruhnya dalam salat, dengan jadwal harian terperinci. | Al-Dhahabi mencatat laporan 60 khatam dan tambahan “dalam salat” pada satu jalur; rincian antarsumber tidak seragam. Laporan biografi dibedakan dari tuntunan Nabi dalam Bukhari 5054. |
| Hadis amal konsisten dipakai seolah menetapkan jumlah tilawah harian. | Bukhari 6464/Muslim 782b adalah prinsip amal umum. Target aplikasi merupakan penerapan redaksi. Penilaian Tirmidzi 2910 disebut eksplisit. |
| Utsman disebut sering khatam satu rakaat, tidak tidur sebelum khatam, dan kutipan tentang hati bersih disajikan pasti. | Fokus pada riwayat sahih Bukhari 4986–4987 tentang penghimpunan dan penyalinan mushaf. Klaim kebiasaan dan kutipan yang tidak cukup kuat dihapus. |

## Alur data

`index.html` memuat artikel bawaan dari `potret-content.js`. `api.supabase.js` membaca baris `public.konten` dengan kunci `potret_<id>`; nilai setiap baris adalah objek JSON artikel. Artikel Supabase menggantikan artikel bawaan dengan ID yang sama. Baris tanpa JSON valid diabaikan, dan artikel bawaan tetap tersedia saat offline atau tabel belum diisi. Set `aktif: false` pada objek artikel untuk menyembunyikan artikel bawaan dengan ID sama.

Bidang wajib: `judul`, `kategori`, `penulis`, `tanggal` (`YYYY-MM-DD`), `ringkasan`, `isi`. `sumber` berupa daftar objek `{ nomor, sitasi, status, url }`. Gunakan kategori `Panduan`, `Kisah Sahabat`, atau `Kisah Ulama` agar filter dan warna kartu konsisten.

`Potret.txt` adalah arsip integrasi Google Apps Script. Berkas `../index.txt` dan `../indexgit.txt` juga merupakan salinan lama yang masih memuat teks sebelum audit; ketiganya bukan sumber untuk situs Supabase.
