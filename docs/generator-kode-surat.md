# Generator kode lengkap Surat Dinas dan Nota Dinas

## Perilaku pengguna

Setelah permintaan individual berhasil menerbitkan nomor, panel hasil menawarkan
“Butuh rekomendasi kode lengkap untuk surat?” dan tombol “Buat Kode Lengkap Surat”.
Fitur tersedia untuk Surat Dinas dan Nota Dinas, termasuk nomor mundur dari reservasi.
SK/SE tidak menampilkan fitur ini. Tampilan hasil massal tidak diubah oleh modul ini.

Nomor, jenis, dan tanggal surat diambil dari respons server untuk record yang telah
diterbitkan. Nomor dan tahun ditampilkan read-only. Tahun mengikuti tanggal surat,
bukan tahun pada perangkat pengguna. Bulan awal mengikuti tanggal surat dan dapat
dipilih pengguna. Pergantian bulan tidak mengubah tanggal record di spreadsheet.
Generator adalah rekomendasi format; hasil perlu dicocokkan dengan isi surat.

Pilihan sifat: B (Biasa), Sg (Segera), Pt (Penting), R (Rahasia), SR (Sangat Rahasia).
Pilihan penandatangan langsung mencakup 27 jabatan. Mode a.n. Rektor menetapkan
kode R sebagai pejabat yang diatasnamakan dan menyediakan 26 pejabat pelaksana,
tanpa Rektor. Ini menyederhanakan pilihan pertama a.n. pada Excel sesuai lingkup
fitur yang diminta pemilik proyek.

Contoh hasil:

```text
Langsung:     B-469/Un.07/01/BU/PP.00.9/04/2026
a.n. Rektor:  B-469/Un.07/01/R/BU/PP.00.9/04/2026
Tanpa tersier: B-469/Un.07/01/BU/KU.05/04/2026
```

Primer yang berubah mengosongkan sekunder dan tersier. Sekunder yang berubah
mengosongkan tersier. Tersier hanya ditampilkan jika tersedia pada induk tersebut,
dan wajib dipilih untuk cabang yang memiliki tersier. Tombol salin aktif setelah
seluruh pilihan yang diperlukan lengkap. Penyalinan menggunakan Clipboard API
dengan fallback; kegagalan tidak dilaporkan sebagai keberhasilan.

Generator hanya bekerja di browser. Tidak ada nomor baru, perubahan counter,
penulisan spreadsheet, panggilan server tambahan, atau penyimpanan kode lengkap.
Memulai permintaan baru membersihkan seluruh konteks dan hasil generator lama.

## Sumber master

Sumber: `GENERATOR KODE SURAT DI LINGKUNGAN KANTOR PUSAT UIN SUNAN AMPEL SURABAYA 2024 (3).xlsx`,
sheet `GENERATOR`. Pemilik proyek telah memeriksa peraturan asli dan menetapkan
Excel sebagai acuan pada 29 Oktober 2026. SHA-256 file sumber:

```text
89845dfdc4cdaf949b564b79e5510bc4e46a4a664789e180e0b917128fb9cc93
```

Master berada dalam variabel `LETTER_CODE_MASTER` pada `LetterCodes.html`:
27 jabatan, 12 primer, 65 sekunder, dan 96 tersier. Kode merupakan string agar
nol di depan (`00`, `01`, dst.) tetap utuh. Anak klasifikasi disimpan di bawah
induknya, sehingga nama yang sama tidak mencampurkan cabang berbeda.

Rentang asal:

| Data | Lokasi pada Excel |
|---|---|
| Mapping jabatan | Rumus `O14`, identik dengan `O30` dan `Q30` |
| Jabatan langsung / pelaksana a.n. | `AF21:AF47` / `AF51:AF76` |
| Kode primer | `AJ155:AK166` |
| Hubungan primer–sekunder | Header `AJ8:AU8`, isi baris 9–18 |
| Kode sekunder | `AJ56:AK119` |
| Hubungan sekunder–tersier | Header `AJ21:BK21`, isi baris 22–33 |
| Kode tersier | `AL56:AM151` |

Keputusan data yang harus dipertahankan:

- `TL.03` adalah Penelitian → Pengembangan Penelitian, dikonfirmasi langsung
  oleh pemilik proyek pada 29 Oktober 2026. Pilihan sudah ada di Excel, tetapi
  pasangan kodenya hilang dari tabel lookup Excel.
- Pengaduan Masyarakat (Non TP 5000) memakai `PS.03.4`, bukan `PS.04` dari HTML lama.
- `KU.03` hanya memiliki tersier `1` (Pajak). HTML lama menambahkan Bukan Pajak.
- `KP.04` hanya memiliki tersier `1` dan `2`. HTML lama menambahkan Latihan Kursus.
- Haji → Bimbingan (`HJ.01`) tidak memakai tersier Bimbingan milik Pembinaan Agama
  (`BA.01.1` dan `BA.01.2`). Dropdown Excel sebelumnya mencampur kedua nama ini.
- Titik pemisah hanya ditambahkan untuk komponen yang terisi; tahun tetap 2024
  dan placeholder nomor pada Excel tidak dibawa ke aplikasi.

Tidak ada perubahan redaksi jabatan atau nama klasifikasi berdasarkan perkiraan
struktur organisasi terbaru. Pembaruan berikutnya harus memakai sumber resmi
yang ditetapkan pemilik proyek.

## Integrasi teknis dan deployment

`Code.js:doGet()` mengevaluasi template `Index.html`. Fungsi privat
`includeLetterCodeGenerator_()` memasukkan partial `LetterCodes.html` ke panel
hasil. Partial berisi CSS yang dibatasi pada modul, markup, master, dan controller
`LetterCodeGenerator`.

Respons `reserveRequest` dan `claimBackdatedSlot_` memuat `documentType` dan
`letterDate` (`YYYY-MM-DD`). Respons permintaan berulang dengan token sama
mengambil metadata dari record tersimpan, bukan isian baru pemohon. Jika tanggal
record lama tidak dapat dibaca, pemulihan nomor tetap berhasil dan generator
tidak ditampilkan untuk metadata yang belum lengkap.

`handleReservationSuccess` mengonfigurasi modul setelah nomor terbit. Modul tetap
dapat digunakan selama draft diunggah; kegagalan upload tidak menerbitkan nomor
lain. `requestAgain` membersihkan modul. Controller tidak memanggil API penomoran.

Tidak ada migrasi data, izin OAuth baru, trigger baru, atau langkah instalasi sheet.
Deploy semua file bersama: `Index.html`, `LetterCodes.html`, `Code.js`, dan
`Reservations.js` saling bergantung. Jangan memasang `Index.html` baru tanpa partial.

Workflow yang sudah ada tetap digunakan. Push ke branch produksi menyinkronkan
Apps Script. Penanda `[deploy-webapp]` pada pesan commit memperbarui deployment
web app yang sama. Untuk rollback, deploy ulang revisi sebelumnya yang lengkap.

## Verifikasi

```bash
node tests/letter-codes.cjs
node tests/reservations.cjs
node tests/admin-edit.cjs
git diff --check
```

Pengujian generator mencakup kode langsung/a.n., klasifikasi tanpa tersier,
keputusan master Excel, TL.03, reset ketergantungan, identitas nomor dan tahun,
penolakan SK/SE, bulan berurutan, Clipboard API gagal/berhasil, serta pembersihan
konteks saat permintaan berikutnya. Tes reservasi juga memeriksa metadata tanggal
dan jenis pada pengajuan biasa, mundur, lintas tahun, dan pengiriman ulang.
Pengujian lokal memakai fixture; jangan menerbitkan nomor produksi untuk QA.
