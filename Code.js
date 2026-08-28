var APP = {
  TITLE: 'Form Pengajuan Nomor Surat Kantor Pusat UIN Sunan Ampel Surabaya',
  SPREADSHEET_ID: '1C-u9r4440ZDprkcZMSnjbjki-FoVEF99DmwJmUZpjXs',
  ROOT_FOLDER_ID: '1KF7Ak9xReV8MvLmtzMd855tihVi0XBlB',
  WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbz4i88ZxnpnlvDV2bgBH3eebT2m7tAHMRo_vCJOurG1BF6HTzT28dXXss3A97gMp-DH/exec',
  TIMEZONE: 'Asia/Jakarta',
  ADMIN_EMAIL: 'bag.umum@uinsa.ac.id',
  DATA_SHEET: 'PERMINTAAN',
  SETTINGS_SHEET: 'PENGATURAN',
  LOG_SHEET: 'LOG_PERUBAHAN',
  MAX_FILE_SIZE_MB: 10,
  UPLOAD_CLAIM_TIMEOUT_MINUTES: 15,
  ALLOWED_EXTENSIONS: ['pdf', 'doc', 'docx', 'xls', 'xlsx']
};

var SPREADSHEET_INSTANCE_ = null;

var REQUEST_HEADERS = [
  'Tanggal dan Waktu Permintaan',
  'Nomor Surat',
  'Jenis Surat',
  'Perihal',
  'Dari',
  'Kepada',
  'Nama Pemohon',
  'Unit Kerja',
  'Email Terdeteksi',
  'Link Alih Media',
  'Status',
  'ID Permintaan',
  'Tahun',
  'Nama File Asli',
  'ID File Drive',
  'Token Pengiriman',
  'Kunci Pengguna Sementara',
  'Diperbarui Pada'
];

var LOG_HEADERS = [
  'Timestamp',
  'ID Permintaan',
  'Nomor Surat',
  'Aksi',
  'Kolom',
  'Nilai Lama',
  'Nilai Baru',
  'Alasan',
  'Admin Email'
];

var UNIT_OPTIONS = [
  'Bagian Umum',
  'Bagian Perencanaan',
  'Bagian Organisasi dan Kepegawaian',
  'Bagian Keuangan dan Akuntansi',
  'Bagian Akademik',
  'Bagian Kerjasama, Kelembagaan dan Humas',
  'Bagian Kemahasiswaan dan Alumni',
  'Klinik',
  'LP2M',
  'LPM',
  'Pusat Percetakan',
  'Perpustakaan',
  'Pusat Layanan Internasional',
  'Pusat Mahad Al-Jamiah',
  'Pusat Pengembangan Bahasa',
  'Pusat Pengembangan Bisnis',
  'PUSTIPD',
  'SPI',
  'Badan Pengelolaan Penerimaan Mahasiswa Baru',
  'Senat Universitas',
  'Pusat Studi Pengukuran dan Pengujian Pendidikan'
];

var DOCUMENT_TYPES = {
  'Surat Dinas': {
    counterKey: 'NEXT_SURAT_DINAS',
    folderName: 'Surat Dinas',
    fileCode: 'SD',
    requiresRouting: true
  },
  'Nota Dinas': {
    counterKey: 'NEXT_NOTA_DINAS',
    folderName: 'Nota Dinas',
    fileCode: 'ND',
    requiresRouting: true
  },
  'SK/SE': {
    counterKey: 'NEXT_SK_SE',
    folderName: 'SK-SE',
    fileCode: 'SK-SE',
    requiresRouting: false
  }
};

var REQUEST_STATUS = {
  WAITING_UPLOAD: 'MENUNGGU_UPLOAD',
  UPLOADING: 'MENGUNGGAH',
  ACTIVE: 'AKTIF',
  UPLOAD_FAILED: 'UPLOAD_GAGAL',
  FAILED: 'GAGAL',
  CANCELLED: 'DIBATALKAN'
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(APP.TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Administrasi Nomor Surat')
    .addItem('Edit Permintaan Terpilih', 'showEditDialog')
    .addItem('Batalkan Permintaan Terpilih', 'cancelSelectedRequest')
    .addSeparator()
    .addItem('Arsipkan Data Tahun Lalu', 'archiveOldYearsManual')
    .addSeparator()
    .addItem('Buka Pengaturan Counter', 'openSettingsSheet')
    .addItem('Instal / Perbaiki Sistem', 'initializeApplication')
    .addToUi();
}

/**
 * Dijalankan satu kali oleh bag.umum@uinsa.ac.id setelah kode dipasang.
 * Fungsi ini idempotent dan tidak menimpa nilai counter yang sudah ada.
 */
function initializeApplication() {
  assertAdmin_();

  var spreadsheet = getSpreadsheet_();
  spreadsheet.setSpreadsheetTimeZone(APP.TIMEZONE);

  ensureRequiredSheets_(spreadsheet);
  ensureHeaders_(spreadsheet);
  ensureStatusValidation_(spreadsheet);
  ensureDefaultSettings_(spreadsheet);
  ensureYearFolders_();
  ensureArchiveTrigger_();

  SpreadsheetApp.getUi().alert(
    'Sistem siap digunakan.\n\n' +
    'Spreadsheet, pengaturan counter, log perubahan, folder tahun berjalan, ' +
    'dan trigger arsip tahunan telah diverifikasi.'
  );
}

/**
 * Dapat dijalankan admin bila aturan dropdown Status pernah berubah.
 * Tidak mengubah isi data; hanya menyelaraskan validasi kolom K.
 */
function repairStatusValidation() {
  assertAdmin_();
  var spreadsheet = getSpreadsheet_();
  ensureStatusValidation_(spreadsheet);
  SpreadsheetApp.flush();

  return {
    success: true,
    message: 'Validasi status berhasil diperbarui.'
  };
}

/**
 * Tahap 1: reservasi nomor dan simpan data teks tanpa mengirim file.
 * Lock hanya dipegang selama counter dan satu baris spreadsheet diperbarui.
 */
function reserveRequest(requestObject) {
  if (!requestObject) {
    throw new Error('Data permintaan tidak ditemukan. Silakan muat ulang halaman.');
  }

  var request = normalizePublicRequest_(requestObject);
  validatePublicFields_(request);
  validateDraftMetadata_(request.draftName, request.draftSize);

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockError) {
    throw new Error(
      'Sistem sedang memproses permintaan lain. Silakan tunggu beberapa detik lalu kirim kembali.'
    );
  }

  var reservedNumber = null;
  var requestId = Utilities.getUuid();
  var now = new Date();

  try {
    var duplicate = findExistingByToken_(request.token);
    if (duplicate) {
      if (duplicate.status === REQUEST_STATUS.CANCELLED) {
        throw new Error(
          'Permintaan ini sudah dibatalkan. Muat ulang halaman untuk membuat permintaan baru.'
        );
      }

      return {
        success: true,
        number: duplicate.number,
        requestId: duplicate.requestId,
        status: duplicate.status,
        uploadComplete: duplicate.status === REQUEST_STATUS.ACTIVE,
        duplicateSubmission: true
      };
    }

    var year = Number(Utilities.formatDate(now, APP.TIMEZONE, 'yyyy'));
    var settings = getSettings_();
    settings = resetCountersForNewYearIfNeeded_(settings, year);

    var typeConfig = DOCUMENT_TYPES[request.documentType];
    reservedNumber = reserveNextNumber_(settings, typeConfig.counterKey);

    var dataSheet = getRequiredSheet_(APP.DATA_SHEET);
    dataSheet.appendRow([
      now,
      reservedNumber,
      request.documentType,
      request.subject,
      request.from,
      request.to,
      request.applicantName,
      request.unit,
      getDetectedEmail_(),
      '',
      REQUEST_STATUS.WAITING_UPLOAD,
      requestId,
      year,
      request.draftName,
      '',
      request.token,
      getTemporaryUserKey_(),
      now
    ]);

    SpreadsheetApp.flush();

    return {
      success: true,
      number: reservedNumber,
      requestId: requestId,
      status: REQUEST_STATUS.WAITING_UPLOAD,
      uploadComplete: false,
      duplicateSubmission: false
    };
  } catch (error) {
    if (reservedNumber !== null) {
      recordFailedReservation_(
        now,
        requestId,
        reservedNumber,
        request,
        error
      );
    }
    throw new Error(toUserSafeError_(error));
  } finally {
    lock.releaseLock();
  }
}

/**
 * Tahap 2: menerima Blob setelah nomor sudah ditampilkan di browser.
 * Pembuatan file Drive dilakukan tanpa memegang lock.
 */
function uploadDraft(formObject) {
  if (!formObject) {
    throw new Error('Data unggahan tidak ditemukan. Silakan muat ulang halaman.');
  }

  var requestId = cleanText_(
    formObject.reservedRequestId || formObject.requestId,
    120
  );
  var token = cleanText_(formObject.requestToken, 120);
  if (!requestId || !token) {
    throw new Error('Identitas permintaan tidak ditemukan. Silakan hubungi admin.');
  }

  var draft;
  try {
    draft = validateDraft_(formObject.draft);
  } catch (validationError) {
    markPendingUploadFailure_(requestId, token, validationError);
    throw new Error(toUserSafeError_(validationError));
  }

  var claim = claimUpload_(requestId, token);
  if (claim.alreadyComplete) {
    return {
      success: true,
      number: claim.number,
      requestId: requestId,
      uploadComplete: true,
      duplicateSubmission: true
    };
  }

  var driveFile = null;
  var createdNewFile = false;
  try {
    var typeConfig = DOCUMENT_TYPES[claim.documentType];
    if (!typeConfig) {
      throw new Error('Jenis surat pada data permintaan tidak valid.');
    }

    var targetFolder = getTargetFolder_(claim.year, typeConfig.folderName);
    var finalFileName = buildStoredFileName_(
      claim.year,
      typeConfig.fileCode,
      claim.number,
      claim.applicantName,
      draft.originalName
    );

    var storedFile = getOrCreateUploadFile_(
      targetFolder,
      finalFileName,
      draft.blob
    );
    driveFile = storedFile.file;
    createdNewFile = storedFile.created;

    finalizeUpload_(
      requestId,
      token,
      draft.originalName,
      driveFile.getId(),
      driveFile.getUrl()
    );

    return {
      success: true,
      number: claim.number,
      requestId: requestId,
      uploadComplete: true,
      duplicateSubmission: false
    };
  } catch (error) {
    if (driveFile && createdNewFile) {
      try {
        driveFile.setTrashed(true);
      } catch (trashError) {
        // Jangan menutupi error utama jika pembersihan file gagal.
      }
    }

    markUploadFailure_(requestId, token, error);
    throw new Error(toUserSafeError_(error));
  }
}

/**
 * Kompatibilitas untuk halaman versi lama yang masih terbuka di browser.
 * Alur lama tetap bekerja, tetapi respons menunggu upload selesai.
 */
function submitRequest(formObject) {
  if (!formObject) {
    throw new Error('Data permintaan tidak ditemukan. Silakan muat ulang halaman.');
  }

  var draft = validateDraft_(formObject.draft);
  var reservationPayload = {
    documentType: formObject.documentType,
    subject: formObject.subject,
    from: formObject.from,
    to: formObject.to,
    applicantName: formObject.applicantName,
    unit: formObject.unit,
    requestToken: formObject.requestToken,
    draftName: draft.originalName,
    draftSize: draft.size
  };
  var reservation = reserveRequest(reservationPayload);
  if (reservation.uploadComplete) {
    return reservation;
  }

  formObject.reservedRequestId = reservation.requestId;
  return uploadDraft(formObject);
}

function normalizePublicRequest_(formObject) {
  return {
    documentType: cleanText_(formObject.documentType, 40),
    subject: cleanMultilineText_(formObject.subject, 500),
    from: cleanMultilineText_(formObject.from, 300),
    to: cleanMultilineText_(formObject.to, 300),
    applicantName: cleanText_(formObject.applicantName, 150),
    unit: cleanText_(formObject.unit, 200),
    token: cleanText_(formObject.requestToken, 120),
    draftName: cleanFileName_(formObject.draftName),
    draftSize: Number(formObject.draftSize || 0)
  };
}

function validatePublicFields_(request) {
  if (!DOCUMENT_TYPES[request.documentType]) {
    throw new Error('Jenis surat tidak valid.');
  }
  if (!request.subject) {
    throw new Error('Perihal wajib diisi.');
  }
  if (!request.applicantName) {
    throw new Error('Nama pemohon wajib diisi.');
  }
  if (UNIT_OPTIONS.indexOf(request.unit) === -1) {
    throw new Error('Unit kerja tidak valid.');
  }
  if (!request.token) {
    throw new Error('Token pengiriman tidak ditemukan. Silakan muat ulang halaman.');
  }

  if (DOCUMENT_TYPES[request.documentType].requiresRouting) {
    if (!request.from) {
      throw new Error('Kolom Dari wajib diisi untuk jenis surat ini.');
    }
    if (!request.to) {
      throw new Error('Kolom Kepada wajib diisi untuk jenis surat ini.');
    }
  } else {
    request.from = '';
    request.to = '';
  }
}

function validateDraft_(blob) {
  if (!blob || typeof blob.getBytes !== 'function') {
    throw new Error('Draft surat wajib diunggah.');
  }

  var bytes = blob.getBytes();
  var originalName = cleanFileName_(blob.getName());
  if (!originalName || bytes.length === 0) {
    throw new Error('Draft surat wajib diunggah.');
  }

  var extension = getExtension_(originalName);
  if (APP.ALLOWED_EXTENSIONS.indexOf(extension) === -1) {
    throw new Error(
      'Format file tidak didukung. Gunakan PDF, Word (.doc/.docx), atau Excel (.xls/.xlsx).'
    );
  }

  var maxBytes = APP.MAX_FILE_SIZE_MB * 1024 * 1024;
  if (bytes.length > maxBytes) {
    throw new Error('Ukuran file melebihi batas maksimum ' + APP.MAX_FILE_SIZE_MB + ' MB.');
  }

  return {
    blob: blob,
    originalName: originalName,
    extension: extension,
    size: bytes.length
  };
}

function validateDraftMetadata_(fileName, fileSize) {
  var originalName = cleanFileName_(fileName);
  var size = Number(fileSize);

  if (!originalName || !isFinite(size) || size <= 0) {
    throw new Error('Draft surat wajib diunggah.');
  }

  var extension = getExtension_(originalName);
  if (APP.ALLOWED_EXTENSIONS.indexOf(extension) === -1) {
    throw new Error(
      'Format file tidak didukung. Gunakan PDF, Word (.doc/.docx), atau Excel (.xls/.xlsx).'
    );
  }

  var maxBytes = APP.MAX_FILE_SIZE_MB * 1024 * 1024;
  if (size > maxBytes) {
    throw new Error('Ukuran file melebihi batas maksimum ' + APP.MAX_FILE_SIZE_MB + ' MB.');
  }
}

function findExistingByToken_(token) {
  var sheet = getRequiredSheet_(APP.DATA_SHEET);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return null;
  }

  var tokenRange = sheet.getRange(2, 16, lastRow - 1, 1);
  var matches = tokenRange.createTextFinder(token)
    .matchEntireCell(true)
    .findAll();

  if (!matches || !matches.length) {
    return null;
  }

  for (var i = matches.length - 1; i >= 0; i--) {
    var row = matches[i].getRow();
    var values = sheet.getRange(row, 1, 1, REQUEST_HEADERS.length).getValues()[0];
    var status = String(values[10] || '');
    if (status !== REQUEST_STATUS.FAILED) {
      return {
        number: values[1],
        requestId: values[11],
        status: status
      };
    }
  }

  return null;
}

function claimUpload_(requestId, token) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockError) {
    throw new Error('Sistem sedang sibuk. Silakan coba upload kembali beberapa detik lagi.');
  }

  try {
    var record = findRequestByIdentity_(requestId, token);
    var status = record.status;
    var recoveringStaleUpload =
      status === REQUEST_STATUS.UPLOADING &&
      isStaleUploadClaim_(record.values[17]);

    if (status === REQUEST_STATUS.ACTIVE && record.values[14]) {
      return {
        alreadyComplete: true,
        number: record.values[1]
      };
    }
    if (status === REQUEST_STATUS.CANCELLED) {
      throw new Error('Permintaan ini telah dibatalkan oleh admin.');
    }
    if (status === REQUEST_STATUS.FAILED) {
      throw new Error('Reservasi nomor ini gagal dan tidak dapat diunggah.');
    }
    if (
      status === REQUEST_STATUS.UPLOADING &&
      !recoveringStaleUpload
    ) {
      throw new Error('Draft sedang diproses. Mohon tunggu dan jangan mengirim ulang.');
    }
    if (status !== REQUEST_STATUS.WAITING_UPLOAD &&
        status !== REQUEST_STATUS.UPLOAD_FAILED &&
        !recoveringStaleUpload) {
      throw new Error('Status permintaan tidak dapat diproses. Hubungi admin.');
    }

    var now = new Date();
    record.sheet.getRange(record.row, 11).setValue(REQUEST_STATUS.UPLOADING);
    record.sheet.getRange(record.row, 18).setValue(now);
    SpreadsheetApp.flush();

    return {
      alreadyComplete: false,
      number: record.values[1],
      documentType: String(record.values[2] || ''),
      applicantName: String(record.values[6] || ''),
      year: Number(record.values[12])
    };
  } finally {
    lock.releaseLock();
  }
}

function finalizeUpload_(requestId, token, originalName, fileId, fileUrl) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockError) {
    throw new Error('File sudah diterima, tetapi pencatatan belum selesai. Silakan coba lagi.');
  }

  try {
    var record = findRequestByIdentity_(requestId, token);
    if (record.status === REQUEST_STATUS.ACTIVE &&
        String(record.values[14] || '') === String(fileId)) {
      return;
    }
    if (record.status === REQUEST_STATUS.CANCELLED) {
      throw new Error('Permintaan ini telah dibatalkan oleh admin.');
    }
    if (record.status !== REQUEST_STATUS.UPLOADING) {
      throw new Error('Status unggahan berubah sebelum pencatatan selesai.');
    }

    var now = new Date();
    record.sheet.getRange(record.row, 10, 1, 6).setValues([[
      fileUrl,
      REQUEST_STATUS.ACTIVE,
      requestId,
      record.values[12],
      originalName,
      fileId
    ]]);
    record.sheet.getRange(record.row, 18).setValue(now);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

function markPendingUploadFailure_(requestId, token, error) {
  updateUploadFailure_(
    requestId,
    token,
    error,
    [REQUEST_STATUS.WAITING_UPLOAD, REQUEST_STATUS.UPLOAD_FAILED]
  );
}

function markUploadFailure_(requestId, token, error) {
  updateUploadFailure_(
    requestId,
    token,
    error,
    [REQUEST_STATUS.UPLOADING]
  );
}

function updateUploadFailure_(requestId, token, error, allowedStatuses) {
  var lock = LockService.getScriptLock();
  var acquired = false;
  try {
    lock.waitLock(30000);
    acquired = true;

    var record = findRequestByIdentity_(requestId, token);
    if (allowedStatuses.indexOf(record.status) === -1) {
      return;
    }

    var now = new Date();
    record.sheet.getRange(record.row, 11).setValue(REQUEST_STATUS.UPLOAD_FAILED);
    record.sheet.getRange(record.row, 18).setValue(now);

    appendLogRows_([[
      now,
      requestId,
      record.values[1],
      'UPLOAD GAGAL',
      'Status',
      record.status,
      REQUEST_STATUS.UPLOAD_FAILED,
      String(error && error.message ? error.message : error),
      APP.ADMIN_EMAIL
    ]]);
    SpreadsheetApp.flush();
  } catch (loggingError) {
    // Jangan menutupi error unggahan jika pencatatan status gagal.
  } finally {
    if (acquired) {
      lock.releaseLock();
    }
  }
}

function findRequestByIdentity_(requestId, token) {
  var sheet = getRequiredSheet_(APP.DATA_SHEET);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    throw new Error('Data permintaan tidak ditemukan.');
  }

  var matches = sheet.getRange(2, 12, lastRow - 1, 1)
    .createTextFinder(requestId)
    .matchEntireCell(true)
    .findAll();

  for (var i = matches.length - 1; i >= 0; i--) {
    var row = matches[i].getRow();
    var values = sheet.getRange(row, 1, 1, REQUEST_HEADERS.length).getValues()[0];
    if (String(values[15] || '') === token) {
      return {
        sheet: sheet,
        row: row,
        values: values,
        status: String(values[10] || '')
      };
    }
  }

  throw new Error('Identitas permintaan tidak cocok. Silakan hubungi admin.');
}

function resetCountersForNewYearIfNeeded_(settings, currentYear) {
  var configuredYear = Number(settings.values.COUNTER_YEAR);
  if (configuredYear === currentYear) {
    return settings;
  }

  setSettingValues_({
    COUNTER_YEAR: currentYear,
    NEXT_SURAT_DINAS: 1,
    NEXT_NOTA_DINAS: 1,
    NEXT_SK_SE: 1
  });

  return getSettings_();
}

function reserveNextNumber_(settings, counterKey) {
  var number = Number(settings.values[counterKey]);
  if (!isPositiveInteger_(number)) {
    throw new Error(
      'Nilai counter ' + counterKey + ' tidak valid. Hubungi admin Bagian Umum.'
    );
  }

  var counterRow = settings.rowByKey[counterKey];
  if (!counterRow) {
    throw new Error(
      'Kunci pengaturan "' + counterKey + '" tidak ditemukan.'
    );
  }

  settings.sheet.getRange(counterRow, 2).setValue(number + 1);
  settings.values[counterKey] = number + 1;
  return number;
}

function getTargetFolder_(year, typeFolderName) {
  var root = DriveApp.getFolderById(APP.ROOT_FOLDER_ID);
  var yearFolder = getOrCreateFolder_(root, String(year));
  return getOrCreateFolder_(yearFolder, typeFolderName);
}

/**
 * Menggunakan kembali file orphan dengan nama final yang sama bila eksekusi
 * sebelumnya terputus setelah file dibuat tetapi sebelum status diselesaikan.
 */
function getOrCreateUploadFile_(targetFolder, finalFileName, blob) {
  var existingFiles = targetFolder.getFilesByName(finalFileName);
  if (existingFiles.hasNext()) {
    return {
      file: existingFiles.next(),
      created: false
    };
  }

  var file = targetFolder.createFile(blob);
  file.setName(finalFileName);
  return {
    file: file,
    created: true
  };
}

function isStaleUploadClaim_(updatedAt) {
  var timestamp = updatedAt instanceof Date
    ? updatedAt.getTime()
    : new Date(updatedAt).getTime();
  var timeoutMs = APP.UPLOAD_CLAIM_TIMEOUT_MINUTES * 60 * 1000;

  return !isFinite(timestamp) ||
    new Date().getTime() - timestamp >= timeoutMs;
}

function ensureYearFolders_() {
  var year = Utilities.formatDate(new Date(), APP.TIMEZONE, 'yyyy');
  var root = DriveApp.getFolderById(APP.ROOT_FOLDER_ID);
  var yearFolder = getOrCreateFolder_(root, year);

  getOrCreateFolder_(yearFolder, 'Surat Dinas');
  getOrCreateFolder_(yearFolder, 'Nota Dinas');
  getOrCreateFolder_(yearFolder, 'SK-SE');
}

function getOrCreateFolder_(parent, name) {
  var iterator = parent.getFoldersByName(name);
  if (iterator.hasNext()) {
    return iterator.next();
  }
  return parent.createFolder(name);
}

function buildStoredFileName_(year, code, number, applicantName, originalName) {
  var applicant = sanitizeFilePart_(applicantName, 55);
  var original = sanitizeFilePart_(originalName, 90);
  return [year, code, number, applicant, original].join('_');
}

function recordFailedReservation_(timestamp, requestId, number, request, error) {
  try {
    var year = Number(Utilities.formatDate(timestamp, APP.TIMEZONE, 'yyyy'));
    var sheet = getRequiredSheet_(APP.DATA_SHEET);
    sheet.appendRow([
      timestamp,
      number,
      request.documentType,
      request.subject,
      request.from,
      request.to,
      request.applicantName,
      request.unit,
      getDetectedEmail_(),
      '',
      REQUEST_STATUS.FAILED,
      requestId,
      year,
      '',
      '',
      request.token,
      getTemporaryUserKey_(),
      timestamp
    ]);

    appendLogRows_([[
      timestamp,
      requestId,
      number,
      'RESERVASI GAGAL',
      'Status',
      '',
      REQUEST_STATUS.FAILED,
      String(error && error.message ? error.message : error),
      APP.ADMIN_EMAIL
    ]]);
  } catch (loggingError) {
    // Counter tetap sudah bergerak maju sehingga nomor tidak akan terbit ganda.
  }
}

function getDetectedEmail_() {
  try {
    return Session.getActiveUser().getEmail() || '';
  } catch (error) {
    return '';
  }
}

function getTemporaryUserKey_() {
  try {
    return Session.getTemporaryActiveUserKey() || '';
  } catch (error) {
    return '';
  }
}

function getSpreadsheet_() {
  if (!SPREADSHEET_INSTANCE_) {
    SPREADSHEET_INSTANCE_ = SpreadsheetApp.openById(APP.SPREADSHEET_ID);
  }
  return SPREADSHEET_INSTANCE_;
}

function getRequiredSheet_(sheetName) {
  var sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet "' + sheetName + '" tidak ditemukan. Hubungi admin.');
  }
  return sheet;
}

function getSettings_() {
  var sheet = getRequiredSheet_(APP.SETTINGS_SHEET);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    throw new Error('Tabel pengaturan belum tersedia.');
  }

  var rows = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  var values = {};
  var rowByKey = {};

  for (var i = 0; i < rows.length; i++) {
    var key = String(rows[i][0] || '').trim();
    if (key) {
      values[key] = rows[i][1];
      rowByKey[key] = i + 2;
    }
  }

  return {
    sheet: sheet,
    values: values,
    rowByKey: rowByKey
  };
}

function setSettingValues_(updates) {
  var settings = getSettings_();
  var keys = Object.keys(updates);

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var row = settings.rowByKey[key];
    if (!row) {
      throw new Error('Kunci pengaturan "' + key + '" tidak ditemukan.');
    }
    settings.sheet.getRange(row, 2).setValue(updates[key]);
  }
}

function ensureRequiredSheets_(spreadsheet) {
  if (!spreadsheet.getSheetByName(APP.DATA_SHEET)) {
    spreadsheet.insertSheet(APP.DATA_SHEET);
  }
  if (!spreadsheet.getSheetByName(APP.SETTINGS_SHEET)) {
    spreadsheet.insertSheet(APP.SETTINGS_SHEET);
  }
  if (!spreadsheet.getSheetByName(APP.LOG_SHEET)) {
    spreadsheet.insertSheet(APP.LOG_SHEET);
  }
}

function ensureHeaders_(spreadsheet) {
  var dataSheet = spreadsheet.getSheetByName(APP.DATA_SHEET);
  var logSheet = spreadsheet.getSheetByName(APP.LOG_SHEET);

  dataSheet.getRange(1, 1, 1, REQUEST_HEADERS.length).setValues([REQUEST_HEADERS]);
  logSheet.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]);
}

function ensureStatusValidation_(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(APP.DATA_SHEET);
  var dataRowCount = sheet.getMaxRows() - 1;
  if (dataRowCount < 1) {
    return;
  }

  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(getRequestStatusOptions_(), true)
    .setAllowInvalid(false)
    .setHelpText('Status dikelola otomatis oleh Sistem Nomor Surat UINSA.')
    .build();

  sheet.getRange(2, 11, dataRowCount, 1).setDataValidation(rule);
}

function getRequestStatusOptions_() {
  return [
    REQUEST_STATUS.WAITING_UPLOAD,
    REQUEST_STATUS.UPLOADING,
    REQUEST_STATUS.ACTIVE,
    REQUEST_STATUS.UPLOAD_FAILED,
    REQUEST_STATUS.FAILED,
    REQUEST_STATUS.CANCELLED
  ];
}

function ensureDefaultSettings_(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(APP.SETTINGS_SHEET);
  var defaults = [
    ['COUNTER_YEAR', Number(Utilities.formatDate(new Date(), APP.TIMEZONE, 'yyyy')), 'Tahun counter yang sedang aktif'],
    ['NEXT_SURAT_DINAS', 1700, 'Nomor Surat Dinas berikutnya yang akan diterbitkan'],
    ['NEXT_NOTA_DINAS', 819, 'Nomor Nota Dinas berikutnya yang akan diterbitkan'],
    ['NEXT_SK_SE', 756, 'Nomor SK/SE berikutnya yang akan diterbitkan'],
    ['ROOT_FOLDER_ID', APP.ROOT_FOLDER_ID, 'Folder induk penyimpanan draft'],
    ['TIMEZONE', APP.TIMEZONE, 'Zona waktu aplikasi dan pencatatan'],
    ['MAX_FILE_SIZE_MB', APP.MAX_FILE_SIZE_MB, 'Ukuran maksimum satu file'],
    ['ALLOWED_EXTENSIONS', APP.ALLOWED_EXTENSIONS.join(','), 'Ekstensi yang diperbolehkan'],
    ['ADMIN_EMAIL', APP.ADMIN_EMAIL, 'Akun admin utama'],
    ['SCHEMA_VERSION', '2.1.1', 'Versi struktur sistem']
  ];

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 3).setValues([['Kunci', 'Nilai', 'Keterangan']]);
  }

  var existing = {};
  if (sheet.getLastRow() >= 2) {
    var keys = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      existing[String(keys[i][0] || '').trim()] = true;
    }
  }

  var missing = [];
  for (var j = 0; j < defaults.length; j++) {
    if (!existing[defaults[j][0]]) {
      missing.push(defaults[j]);
    }
  }

  if (missing.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, missing.length, 3).setValues(missing);
  }
}

function appendLogRows_(rows) {
  if (!rows || !rows.length) {
    return;
  }
  var sheet = getRequiredSheet_(APP.LOG_SHEET);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, LOG_HEADERS.length)
    .setValues(rows);
}

function cleanText_(value, maxLength) {
  var text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  return neutralizeSheetFormula_(text.substring(0, maxLength));
}

function cleanMultilineText_(value, maxLength) {
  var text = String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return neutralizeSheetFormula_(text.substring(0, maxLength));
}

function cleanFileName_(value) {
  var fileName = String(value || '')
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_')
    .trim()
    .substring(0, 180);
  return neutralizeSheetFormula_(fileName);
}

function neutralizeSheetFormula_(value) {
  var text = String(value || '');
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function sanitizeFilePart_(value, maxLength) {
  return String(value || '')
    .replace(/\.[^.]+$/, function(extension) {
      return extension;
    })
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '')
    .substring(0, maxLength) || 'tanpa-nama';
}

function getExtension_(fileName) {
  var match = /\.([^.]+)$/.exec(fileName);
  return match ? match[1].toLowerCase() : '';
}

function isPositiveInteger_(value) {
  return Number.isFinite(value) && Math.floor(value) === value && value > 0;
}

function toUserSafeError_(error) {
  var message = String(error && error.message ? error.message : error || '');
  if (!message) {
    return 'Terjadi kesalahan saat memproses permintaan.';
  }
  return message.substring(0, 500);
}
