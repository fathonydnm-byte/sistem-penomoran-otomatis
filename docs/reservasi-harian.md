# Reservasi harian dan nomor tanggal sebelumnya

## Perilaku

- Empat slot per jenis per hari kerja secara default, dikonfigurasi di KONFIGURASI_RESERVASI.
- Sabtu/Minggu dan tanggal di HARI_LIBUR dikecualikan; jangan masukkan cuti bersama.
- Target pergantian hari WIB. Pemicu setiap menit mendeteksi pergantian tanggal; Apps Script tidak menjamin tepat 00.00. Permintaan individual/massal juga memanggil alokasi terlebih dahulu di bawah script lock yang sama.
- Tidak mengisi tanggal lampau secara otomatis. Jika pemicu tidak berjalan sepanjang satu hari, tanggal itu tidak dibuat mundur keesokan harinya.
- Counter sudah dimajukan sebelum placeholder ditulis. Rencana alokasi disimpan dahulu di Script Properties untuk melanjutkan penulisan terputus tanpa menerbitkan ulang rentang yang sama.
- PERMINTAAN adalah sumber kebenaran slot tersedia. RESERVASI_NOMOR adalah indeks/audit, bukan penentu ketersediaan.
- Claim mengganti placeholder dan token dalam satu penulisan. Retry token yang sama mengembalikan nomor yang sama. Upload gagal tidak membebaskan nomor.
- Kolom A menyimpan tanggal/waktu surat agar identitas nomor tetap melekat pada tanggal slotnya. Kolom S menyimpan kunci tanggal surat (YYYY-MM-DD), T mode, dan U waktu pengajuan aktual untuk audit. Pada permintaan hari ini A dan U bernilai sama; pada permintaan mundur A mengikuti slot sedangkan U mencatat saat pengguna benar-benar mengajukan. Tahun di M mengikuti tanggal surat.
- Slot dan upload tertunda tidak diarsipkan. Slot tahun lampau tidak mengubah counter tahun berjalan.
- LOG_PERMINTAAN mencatat penerbitan individual/massal/mundur dan kejadian upload. Log baru dimulai sejak pemasangan; tidak mengarang riwayat sebelum pemasangan. Kegagalan log sekunder dicatat ke execution log dan tidak membatalkan nomor yang sudah terbit; data permintaan utama tetap tersimpan.

## Pemasangan

1. Gabungkan perubahan sebagai satu paket, lalu clasp push seluruh file termasuk Reservations.js. Jangan deploy sebagian file.
2. Jalankan setupDailyReservations sebagai admin. Pemeriksaan header S/T/U mencegah menimpa kolom lain. KONFIGURASI_RESERVASI dibuat nonaktif.
3. Isi HARI_LIBUR dengan daftar nasional resmi. Isi TAHUN_KALENDER_DIVERIFIKASI (misalnya 2026,2027) hanya setelah seluruh tanggal tahun itu diperiksa. Tahun yang belum diverifikasi menghentikan penerbitan biasa saat reservasi aktif supaya hari libur tidak diasumsikan hari kerja.
4. Deploy versi baru pada deployment yang sama, lalu jalankan activateDailyReservations dari editor/menu. Jalankan saat pergantian hari atau hari libur untuk menghindari slot di tengah urutan hari berjalan. Aktivasi di tengah hari akan memakai nomor berikutnya; nomor yang sudah diterbitkan tidak diubah.
5. Uji satu permintaan nyata yang memang diperlukan; jangan membuat nomor produksi hanya untuk uji. Uji lokal: `node tests/reservations.cjs`.
6. Reload Spreadsheet untuk menu baru.

## Slot lama

1. Menu Tinjau Slot Kosong Lama membuat TINJAU_SLOT_LAMA. Perihal `Slot Kosong` menjadi penanda utama (case-insensitive setelah trim); Dari/Kepada boleh kosong atau berisi catatan lama.
2. Tinjau tanggal, nomor, jenis, dan hasil SIAP_DITINJAU. Isi Setujui dengan TRUE hanya pada baris benar-benar kosong.
3. Impor Slot Lama yang Disetujui memeriksa ulang fingerprint, identitas, dan duplikasi. Berkas placeholder lama tidak dihapus; tautannya dipertahankan di RESERVASI_NOMOR.
4. Baris meragukan tidak diimpor. Kandidat yang sudah berada di tab arsip ditandai perlu pemindahan admin; tidak otomatis menghapus/memindahkan arsip.
5. Jangan mengubah nomor/tanggal/status placeholder secara manual setelah diaktifkan. Editor umum memblokir pengubahan permintaan mundur dan slot untuk menjaga identitas nomor.

## Batas pengujian

Uji lokal memakai simulasi layanan Apps Script. Tetap diperlukan pemeriksaan UI dan eksekusi pada akun Google sebelum dinyatakan aktif. Penguncian menggunakan LockService asli di produksi; simulasi menguji urutan pengambilan dan token idempotensi, bukan beban paralel jaringan Google.

## Sumber kalender

https://www.kemenkopmk.go.id/pemerintah-tetapkan-17-hari-libur-nasional-dan-8-hari-cuti-bersama-tahun-2026

Kalender harus dimasukkan/diperiksa saat pemasangan; kode tidak mengasumsikan hari libur keagamaan tahun berikutnya.
