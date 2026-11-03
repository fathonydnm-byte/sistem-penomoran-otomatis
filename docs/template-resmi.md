# Akses template resmi UIN Sunan Ampel Surabaya

Pembaruan 3 November 2026 menambahkan tawaran template sebelum formulir pengajuan
nomor pada halaman utama. Tombol membuka folder resmi dalam tab baru:

https://drive.google.com/drive/folders/1f_Uq5h3SJoT5X5GyfLyon_-qef-933_n

Pengguna diarahkan memilih Surat Dinas atau Nota Dinas dan memakai File > Buat
salinan sebelum mengisi surat. Tautan memakai `noopener noreferrer`. Penambahan
ini tidak mengubah counter, unggahan draft, reservasi, atau generator kode surat.
Pengembangan pelengkapan surat final tetap ditunda.

## Pemeriksaan ekspor Word

Dua Google Docs dalam folder diperiksa dan diekspor ulang:

- SURAT DINAS: `1ug2YtRpa0ofLKa69bGw57k2ZmCY54-0C2XXIT-FG3v8`
- NOTA DINAS: `184rL16bHuMSlzBOfVZUZvQ6LObOaimJEpnqSLpZyulI`

Empat paragraf teks kop pada hasil ekspor awal memakai OOXML
`w:spacing w:line="72" w:lineRule="auto"` (0,3 baris), meskipun pembacaan Google
Docs menunjukkan lineSpacing 100. Ini konsisten dengan huruf kop yang terpotong
pada tangkapan layar Microsoft Word pengguna. Render LibreOffice tidak mereproduksi
pemotongan dengan cara yang sama, sehingga hanya pemeriksaan visual melalui mesin
tersebut tidak cukup untuk mendeteksi masalah ini.

Reset eksplisit lineSpacing 100 serta spaceAbove/spaceBelow 0 pada range header
0–227 memperbaiki ekspor menjadi `w:line="240"` (1 baris). Perubahan diuji pada
salinan sebelum diterapkan ke kedua master menggunakan kontrol revisionId.
Cadangan kedua master dibuat sebelum perubahan. Body, objek berposisi, serta footer
dibandingkan dengan pembacaan awal dan tetap identik. Logo dan garis mengambang
dipertahankan karena perbaikan spasi sudah menyelesaikan penyebab pemotongan.

Izin berbagi tidak diubah oleh aplikasi. Setelah dipindahkan oleh pemilik pada
3 November 2026, folder tetap memakai ID dan tautan yang sama. Pemilik
mengonfirmasi akses umum telah diubah menjadi Viewer. Pembacaan metadata
berhasil, tetapi rincian permission tidak tersedia bagi konektor saat pengecekan.

Tawaran template kemudian diperkecil menjadi teks 12 px dan tautan bergaris bawah
di atas formulir, tanpa kartu berwarna, judul besar, atau tombol. Petunjuk
File > Buat salinan tetap tersedia. Fitur ini bersifat opsional.
