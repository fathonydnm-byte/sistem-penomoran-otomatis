# Audit sumber pejabat — 6 November 2026

Sumber: https://docs.google.com/spreadsheets/d/1UR8puYkKdOKyMEqBbXYgBei1hNCvPSoMjGFkxTSgNhM/edit
Tab MASTER PEJABAT, sheetId 0, header baris 2, data baris 4–26. Sumber tidak diubah.

## Kontrak adapter
A kode jabatan; B nama lengkap dengan gelar; C NIP string; D jabatan tampil di TTD termasuk Plt.; E nama tanpa gelar. Judul B/E menyebut 'jabatan', tetapi makna kolom mengikuti konfirmasi pemilik dan isi aktual, yaitu dengan/tanpa gelar.
23 entri jabatan, 16 kode terisi dan 7 kosong. Semua 23 NIP diperiksa sebagai string 18 digit. Jangan parseInt/Number NIP. Tidak ada kolom aktif; untuk uji semua baris bernama dianggap tersedia, kelayakan tanda tangan berkode dinilai terpisah.
Identitas pilihan harus menggabungkan orang dan jabatan, bukan NIP saja. BU dan BU1 dijabat orang yang sama; keduanya valid sebagai pilihan berbeda. Jangan deduplikasi berdasarkan nama atau NIP.

## Temuan untuk pemilik
- R2: kolom B 'Dr. Ali Mustofa, M.Pd', E 'Ali Musthofa'. Jangan koreksi otomatis; konfirmasi ejaan.
- Kode kosong di baris 9, 11, 12, 23, 24, 25, 26. Jabatan tersebut belum dapat digunakan untuk menyusun kode penandatangan sampai mapping resmi ditentukan. Tetap dapat menjadi penerima/manual atau data referensi sesuai konteks. Jangan meminjam kode atasan tanpa keputusan resmi.
- Header B/E tidak diubah di sumber. Adapter memakai mapping posisi yang tervalidasi dan memeriksa header untuk mendeteksi perubahan struktur.
- Data gedung belum diberikan. Gunakan gedung dummy berlabel UJI untuk pengujian pemetaan, jangan dianggap data resmi.
- Master ini belum memuat seluruh hierarki penerima (senat, dekan, direktur, dll.). Master penerima perlu terpisah dari daftar penandatangan agar tidak membatasi pilihan yang telah disepakati.

## Tahap persiapan
Folder uji: https://drive.google.com/drive/folders/1RTs3XUbPs-69anexlGHi003lNjbfDIx_
Salinan template dipisahkan dari master resmi. Tidak ada nomor diterbitkan, deploy atau perubahan aplikasi live. Audit ini memverifikasi data sumber, bukan membuktikan generator sudah berjalan.

## Keputusan lanjutan pemilik — 6 November 2026
- R2 tanpa gelar yang benar adalah Ali Mustofa. Terapkan koreksi terarah pada adapter bila sumber masih Ali Musthofa, tanpa mengubah master sumber.
- Ketujuh jabatan tanpa kode tetap boleh menjadi penandatangan; segmen kode dibiarkan kosong. Temuan penolakan pada bagian sebelumnya telah DIGANTIKAN oleh keputusan ini. Dilarang mengambil kode atasan.
- Kasus contoh langsung mempertahankan /01// dan a.n. mempertahankan /R// agar segmen kosong terlihat. Nama/jabatan tetap diisi normal.
