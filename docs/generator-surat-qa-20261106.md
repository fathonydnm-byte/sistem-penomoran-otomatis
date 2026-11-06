# Hasil uji awal generator surat — 6 November 2026

## Keputusan yang diterapkan
- R2 tanpa gelar menggunakan Ali Mustofa; koreksi terarah pada adapter, tidak mengubah sumber.
- Tujuh jabatan tanpa kode tetap tersedia untuk penandatangan. Segmen kosong dipertahankan secara literal: /Un.07/01// dan a.n. /Un.07/01/R//. Tidak mengambil kode atasan.
- BU dan BU1 tetap dua pilihan jabatan berbeda, walaupun nama/NIP sama.

## Artefak dan bukti
Folder salinan/template/contoh: https://drive.google.com/drive/folders/1RTs3XUbPs-69anexlGHi003lNjbfDIx_
Seluruh contoh menggunakan nomor UJI dan isi kegiatan buatan. Tidak mengambil nomor produksi.
- SD: https://docs.google.com/document/d/1MSwelHCObT9y2kXDw9ZpnqKJIQaY5o4b2xCWEUDqL_8/edit?usp=drivesdk
- UNDANGAN: https://docs.google.com/document/d/1DCuwoYfatgg3Ldpf1grpijCt-_JxMVYorTT5Ei3VYBc/edit?usp=drivesdk
- ST_SPD: https://docs.google.com/document/d/1M98l4arqCH0shNL_DEyrASMIGYkrRBvKAJWR7qk563s/edit?usp=drivesdk
- GEDUNG: https://docs.google.com/document/d/1H4EJ14xEhWhHqtjkWoC__arSu19x9xhRiooLjG7jolM/edit?usp=drivesdk
- KENDARAAN: https://docs.google.com/document/d/1O7vkGViH-R_m_gG_yYSn7BnFf8r2m5ECuIi6yB9YyJ8/edit?usp=drivesdk
- SK: https://docs.google.com/document/d/1nwQudsjDcc_TCi_AAVB775zAV2UshTcMagbZwxzG2H0/edit?usp=drivesdk
- KHUSUS: https://docs.google.com/document/d/13DvbBaDHaNX5NUXb6OUcz6p6xG34uC1FkrHusNYyQiI/edit?usp=drivesdk

## Verifikasi yang sudah dilakukan
1. Prototipe murni experiments/letter-generator/core.cjs dan tes core.test.cjs. Jalankan node experiments/letter-generator/core.test.cjs. Hasil 18 tes lulus.
2. Adapter diuji dengan 23 baris master aktual: 7 kode kosong diterima, Ali Mustofa dikoreksi, BU1 dan BU berbeda. Data NIP aktual tidak ditambahkan ke repositori.
3. Tujuh contoh diisi pada salinan Google Docs, dibaca kembali, diekspor PDF dan diperiksa gambar tiap halaman.
4. Semua 7 PDF akhir satu halaman, tidak ada placeholder mentah tersisa.
5. SD memperlihatkan a.n. Rektor dengan nama lengkap/NIP; ND SK memperlihatkan Ali Mustofa tanpa gelar/NIP; ND khusus memperlihatkan Fitri dengan segmen kode kosong.
6. Koreksi visual: tanggal SD yang semula terbungkus dipindah ke baris rata kanan di atas nomor pada salinan uji; ND khusus yang mewarisi indentasi/bold tanda tangan direset ke gaya badan; daftar penerima undangan dirapikan; baris jumlah kendaraan/peserta dirapikan.
7. Template sumber resmi dan aplikasi live tidak diubah. Salinan template SD dan ND khusus turut diperbaiki supaya masalah dasar tidak terulang.

## Batas hasil
Ini tahap contoh dan logika inti, BUKAN aplikasi siap pakai. Tidak ada deploy, integrasi counter, pengujian beban end-to-end, atau penerbitan nomor.
ST/SPD contoh saat ini satu personel dummy. Tabel multipersonel, dokumen panjang, optional-field kosong, pemulihan transaksi dan 5–10 pengguna bersamaan masih harus diuji pada tahap implementasi.
Master gedung resmi masih menunggu; contoh Gedung Uji A dan tujuan Rektor hanya fixture.
Contoh dibuat melalui konektor, belum melalui tombol web app. Izin everyone-with-link editor pada hasil aplikasi belum diuji.
Sample tanggal SD berada pada baris terpisah untuk stabilitas. Perlu review pemilik atas perubahan kecil tata letak tersebut.
Prototipe mergeText belum merupakan sanitizer rich text maupun validator server lengkap. Pemisahan master/payload/transaksi tetap harus diterapkan sebelum rilis.
Unit test nama tanpa gelar memakai fixture buatan. Hierarki memakai ID dan kelompok, bukan pencocokan nama manusia.

## Tahap selanjutnya
Review contoh isi/tata letak; kemudian implementasi generator draft dengan form, master reader dan Docs renderer di project uji terpisah. Integrasi nomor baru dilakukan setelah draft dan tabel dinamis lulus UAT. Penggunaan produksi menunggu persetujuan setelah pengujian.
