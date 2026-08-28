var ADMIN_EDITABLE_COLUMNS = [
  {index: 0, key: 'timestamp', label: 'Tanggal dan Waktu Permintaan'},
  {index: 1, key: 'number', label: 'Nomor Surat'},
  {index: 2, key: 'documentType', label: 'Jenis Surat'},
  {index: 3, key: 'subject', label: 'Perihal'},
  {index: 4, key: 'from', label: 'Dari'},
  {index: 5, key: 'to', label: 'Kepada'},
  {index: 6, key: 'applicantName', label: 'Nama Pemohon'},
  {index: 7, key: 'unit', label: 'Unit Kerja'},
  {index: 8, key: 'email', label: 'Email Terdeteksi'},
  {index: 9, key: 'fileUrl', label: 'Link Alih Media'}
];

function showEditDialog() {
  var adminEmail = assertAdmin_();

  var sheet = SpreadsheetApp.getActiveSheet();
  var row = sheet.getActiveRange().getRow();
  if (sheet.getName() !== APP.DATA_SHEET || row < 2) {
    SpreadsheetApp.getUi().alert(
      'Pilih salah satu baris data pada tab PERMINTAAN terlebih dahulu.'
    );
    return;
  }

  var requestData = getRequestForEditData_(row);
  requestData.editToken = createAdminEditToken_(requestData, adminEmail);

  var template = HtmlService.createTemplateFromFile('EditDialog');
  template.rowNumber = row;
  template.initialDataJson = serializeForInlineScript_(requestData);
  template.adminEditUrlJson = serializeForInlineScript_(APP.WEB_APP_URL);
  SpreadsheetApp.getUi().showModalDialog(
    template.evaluate().setWidth(680).setHeight(720),
    'Edit Permintaan Nomor Surat'
  );
}

function getRequestForEditData_(rowNumber) {
  var sheet = getRequiredSheet_(APP.DATA_SHEET);
  var row = Number(rowNumber);
  if (!isPositiveInteger_(row) || row < 2 || row > sheet.getLastRow()) {
    throw new Error('Baris data tidak valid.');
  }

  var values = sheet.getRange(row, 1, 1, REQUEST_HEADERS.length).getValues()[0];
  return {
    rowNumber: row,
    requestId: String(values[11] || ''),
    timestamp: formatAdminDate_(values[0]),
    number: values[1],
    documentType: String(values[2] || ''),
    subject: String(values[3] || ''),
    from: String(values[4] || ''),
    to: String(values[5] || ''),
    applicantName: String(values[6] || ''),
    unit: String(values[7] || ''),
    email: String(values[8] || ''),
    fileUrl: String(values[9] || ''),
    status: String(values[10] || '')
  };
}

function saveAdminEdit(payload) {
  if (!payload) {
    throw new Error('Data koreksi tidak ditemukan.');
  }

  var editSession = validateAdminEditToken_(payload);
  var adminEmail = editSession.adminEmail;

  var reason = cleanMultilineText_(payload.reason, 500);
  if (!reason) {
    throw new Error('Alasan koreksi wajib diisi.');
  }

  var rowNumber = Number(payload.rowNumber);
  if (!isPositiveInteger_(rowNumber) || rowNumber < 2) {
    throw new Error('Baris data tidak valid.');
  }

  var sheet = getRequiredSheet_(APP.DATA_SHEET);
  if (rowNumber > sheet.getLastRow()) {
    throw new Error('Baris data tidak ditemukan.');
  }

  var oldValues = sheet.getRange(rowNumber, 1, 1, REQUEST_HEADERS.length)
    .getValues()[0];
  var currentRequestId = String(oldValues[11] || '');
  if (!currentRequestId || currentRequestId !== String(payload.requestId || '')) {
    throw new Error(
      'Data telah berubah sejak dialog dibuka. Tutup dialog lalu pilih ulang barisnya.'
    );
  }

  var edited = normalizeAdminPayload_(payload);
  validateAdminPayload_(edited);

  var editedYear = Number(
    Utilities.formatDate(edited.timestamp, APP.TIMEZONE, 'yyyy')
  );
  var numberingChanged =
    Number(oldValues[1]) !== Number(edited.number) ||
    String(oldValues[2] || '') !== edited.documentType ||
    Number(oldValues[12]) !== editedYear;

  // Pengecekan nomor ganda (dan validasi lain di atas) sengaja dilakukan
  // SEBELUM kunci diambil. Tab PERMINTAAN bisa berisi ribuan baris riwayat,
  // dan permintaan nomor surat publik lain akan tertahan selama kunci ini
  // dipegang -- jadi pekerjaan berat tidak boleh dilakukan sambil memegangnya.
  // Diulang singkat di dalam lock sebelum penulisan untuk menutup celah race.
  if (numberingChanged) {
    assertUniqueNumber_(
      sheet,
      edited.number,
      edited.documentType,
      editedYear,
      rowNumber
    );
  }

  var newValues = oldValues.slice();
  newValues[0] = edited.timestamp;
  newValues[1] = edited.number;
  newValues[2] = edited.documentType;
  newValues[3] = edited.subject;
  newValues[4] = edited.from;
  newValues[5] = edited.to;
  newValues[6] = edited.applicantName;
  newValues[7] = edited.unit;
  newValues[8] = edited.email;
  newValues[9] = edited.fileUrl;
  newValues[12] = editedYear;
  newValues[17] = new Date();

  var logRows = buildEditLogRows_(
    oldValues,
    newValues,
    reason,
    adminEmail
  );

  // Kunci hanya dipegang untuk verifikasi ulang singkat dan penulisan akhir,
  // bukan untuk seluruh proses validasi di atas.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockError) {
    throw new Error(
      'Sistem sedang memproses permintaan lain. Silakan coba simpan kembali beberapa saat lagi.'
    );
  }

  try {
    var latestValues = sheet.getRange(rowNumber, 1, 1, REQUEST_HEADERS.length)
      .getValues()[0];
    if (
      String(latestValues[11] || '') !== currentRequestId ||
      formatLogValue_(latestValues[17]) !== formatLogValue_(oldValues[17])
    ) {
      throw new Error(
        'Data telah berubah sejak validasi terakhir. Tutup dialog lalu pilih ulang barisnya.'
      );
    }

    if (numberingChanged) {
      assertUniqueNumber_(
        sheet,
        edited.number,
        edited.documentType,
        editedYear,
        rowNumber
      );
    }

    sheet.getRange(rowNumber, 1, 1, REQUEST_HEADERS.length)
      .setValues([newValues]);

    if (numberingChanged) {
      keepCounterAheadOfEdit_(
        edited.documentType,
        edited.number,
        editedYear
      );
    }

    appendLogRows_(logRows);

    return {
      success: true,
      message: 'Data berhasil diperbarui dan perubahan telah dicatat.'
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Membuat token bertanda tangan yang hanya diterbitkan setelah showEditDialog
 * berhasil memverifikasi akun admin. Token berlaku 30 menit, terikat pada baris
 * dan ID permintaan, serta dapat diverifikasi oleh deployment web app tanpa
 * bergantung pada sesi/cookie iframe Spreadsheet.
 */
function createAdminEditToken_(requestData, adminEmail) {
  var now = new Date().getTime();
  var sessionData = {
    version: 1,
    rowNumber: Number(requestData.rowNumber),
    requestId: String(requestData.requestId || ''),
    adminEmail: String(adminEmail || ''),
    issuedAt: now,
    expiresAt: now + (30 * 60 * 1000),
    nonce: Utilities.getUuid()
  };
  var body = encodeBase64WebSafe_(
    Utilities.newBlob(JSON.stringify(sessionData)).getBytes()
  );
  var signature = signAdminEditBody_(body);

  return body + '.' + signature;
}

function validateAdminEditToken_(payload) {
  var token = cleanText_(payload.editToken, 1200);
  if (!token) {
    throw new Error(
      'Sesi edit tidak ditemukan. Tutup dialog lalu pilih kembali baris yang akan diedit.'
    );
  }

  var tokenParts = token.split('.');
  if (tokenParts.length !== 2) {
    throw new Error(
      'Sesi edit tidak valid. Tutup dialog lalu pilih kembali baris yang akan diedit.'
    );
  }

  var sessionData;
  try {
    var expectedSignature = signAdminEditBody_(tokenParts[0]);
    if (!constantTimeEquals_(expectedSignature, tokenParts[1])) {
      throw new Error('signature');
    }
    sessionData = JSON.parse(
      Utilities.newBlob(
        Utilities.base64DecodeWebSafe(tokenParts[0])
      ).getDataAsString()
    );
  } catch (error) {
    throw new Error(
      'Sesi edit tidak valid. Tutup dialog lalu pilih kembali baris yang akan diedit.'
    );
  }

  if (
    Number(sessionData.expiresAt) < new Date().getTime() ||
    Number(sessionData.issuedAt) > new Date().getTime() + 60000
  ) {
    throw new Error(
      'Sesi edit telah berakhir. Tutup dialog lalu pilih kembali baris yang akan diedit.'
    );
  }

  if (
    Number(sessionData.rowNumber) !== Number(payload.rowNumber) ||
    String(sessionData.requestId || '') !== String(payload.requestId || '') ||
    String(sessionData.adminEmail || '').toLowerCase() !==
      APP.ADMIN_EMAIL.toLowerCase()
  ) {
    throw new Error(
      'Sesi edit tidak sesuai dengan baris terpilih. Tutup dialog lalu pilih kembali barisnya.'
    );
  }

  return {
    adminEmail: String(sessionData.adminEmail)
  };
}

function signAdminEditBody_(body) {
  return encodeBase64WebSafe_(
    Utilities.computeHmacSha256Signature(
      String(body),
      getOrCreateAdminEditSecret_(),
      Utilities.Charset.UTF_8
    )
  );
}

function getOrCreateAdminEditSecret_() {
  var properties = PropertiesService.getScriptProperties();
  var propertyName = 'ADMIN_EDIT_SIGNING_SECRET_V1';
  var secret = properties.getProperty(propertyName);
  if (secret) {
    return secret;
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    secret = properties.getProperty(propertyName);
    if (!secret) {
      secret = Utilities.getUuid() + Utilities.getUuid() +
        Utilities.getUuid() + Utilities.getUuid();
      properties.setProperty(propertyName, secret);
    }
    return secret;
  } finally {
    lock.releaseLock();
  }
}

function encodeBase64WebSafe_(bytes) {
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, '');
}

function constantTimeEquals_(left, right) {
  var a = String(left || '');
  var b = String(right || '');
  var difference = a.length ^ b.length;
  var length = Math.max(a.length, b.length);

  for (var i = 0; i < length; i++) {
    difference |= (a.charCodeAt(i % (a.length || 1)) || 0) ^
      (b.charCodeAt(i % (b.length || 1)) || 0);
  }
  return difference === 0;
}

/**
 * Penyimpanan langsung dari dialog admin. Deployment web app berjalan sebagai
 * akun resmi UINSA, tetapi hanya payload dengan token admin bertanda tangan
 * yang akan diproses.
 */
function doPost(event) {
  var parameters = event && event.parameter ? event.parameter : {};

  if (parameters.action !== 'adminEdit') {
    return buildAdminPostResponse_(
      false,
      'Permintaan tidak dikenali.'
    );
  }

  try {
    var result = saveAdminEdit(parameters);
    return buildAdminPostResponse_(
      true,
      result.message
    );
  } catch (error) {
    return buildAdminPostResponse_(
      false,
      error && error.message ? error.message : String(error)
    );
  }
}

function buildAdminPostResponse_(success, message) {
  var isSuccess = Boolean(success);
  var title = isSuccess
    ? 'Perubahan berhasil disimpan'
    : 'Perubahan belum disimpan';
  var safeTitle = escapeAdminResponseHtml_(title);
  var safeMessage = escapeAdminResponseHtml_(String(message || ''));
  var color = isSuccess ? '#17643b' : '#8b1f1f';
  var background = isSuccess ? '#effaf3' : '#fff0f0';
  var border = isSuccess ? '#b9dfc7' : '#edb7b7';
  var buttonLabel = isSuccess ? 'Tutup' : 'Kembali ke Form';
  var buttonAction = isSuccess
    ? 'closeDialog()'
    : 'window.history.back()';
  var autoCloseScript = isSuccess
    ? 'window.setTimeout(closeDialog, 1200);'
    : '';

  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>' +
    '*{box-sizing:border-box}body{margin:0;padding:24px;background:#f5f8f6;' +
    'font-family:Arial,Helvetica,sans-serif;color:#24342b}' +
    '.card{max-width:560px;margin:32px auto;padding:24px;background:#fff;' +
    'border:1px solid #d8e2dc;border-radius:10px}' +
    '.status{padding:16px;border:1px solid ' + border + ';border-radius:8px;' +
    'background:' + background + ';color:' + color + '}' +
    'h2{margin:0 0 8px;font-size:20px}p{margin:0;line-height:1.5}' +
    'button{margin-top:18px;padding:10px 16px;border:0;border-radius:6px;' +
    'background:#006b3d;color:#fff;font-weight:bold;cursor:pointer}' +
    '</style></head><body><div class="card"><div class="status">' +
    '<h2>' + safeTitle + '</h2><p>' + safeMessage + '</p></div>' +
    '<button type="button" onclick="' + buttonAction + '">' +
    buttonLabel + '</button></div>' +
    '<script>function closeDialog(){try{google.script.host.close();return;}' +
    'catch(error){try{window.close();}catch(ignore){}}}' +
    autoCloseScript + '</script></body></html>'
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function escapeAdminResponseHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function serializeForInlineScript_(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function cancelSelectedRequest() {
  var adminEmail = assertAdmin_();
  var sheet = SpreadsheetApp.getActiveSheet();
  var row = sheet.getActiveRange().getRow();

  if (sheet.getName() !== APP.DATA_SHEET || row < 2) {
    SpreadsheetApp.getUi().alert(
      'Pilih salah satu baris data pada tab PERMINTAAN terlebih dahulu.'
    );
    return;
  }

  var ui = SpreadsheetApp.getUi();
  var response = ui.prompt(
    'Batalkan Permintaan',
    'Masukkan alasan pembatalan. Nomor tidak akan digunakan kembali.',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  var reason = cleanMultilineText_(response.getResponseText(), 500);
  if (!reason) {
    ui.alert('Pembatalan dibatalkan karena alasan belum diisi.');
    return;
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var values = sheet.getRange(row, 1, 1, REQUEST_HEADERS.length).getValues()[0];
    var oldStatus = String(values[10] || '');
    if (oldStatus === 'DIBATALKAN') {
      ui.alert('Permintaan ini sudah berstatus DIBATALKAN.');
      return;
    }

    values[10] = 'DIBATALKAN';
    values[17] = new Date();
    sheet.getRange(row, 1, 1, REQUEST_HEADERS.length).setValues([values]);

    appendLogRows_([[
      new Date(),
      String(values[11] || ''),
      values[1],
      'PEMBATALAN',
      'Status',
      oldStatus,
      'DIBATALKAN',
      reason,
      adminEmail
    ]]);

    SpreadsheetApp.flush();
    ui.alert(
      'Permintaan berhasil dibatalkan. Nomor ' + values[1] +
      ' tetap tersimpan dalam riwayat dan tidak digunakan kembali.'
    );
  } finally {
    lock.releaseLock();
  }
}

function openSettingsSheet() {
  assertAdmin_();
  var spreadsheet = getSpreadsheet_();
  spreadsheet.setActiveSheet(getRequiredSheet_(APP.SETTINGS_SHEET));
}

function normalizeAdminPayload_(payload) {
  return {
    timestamp: parseAdminDate_(payload.timestamp),
    number: Number(payload.number),
    documentType: cleanText_(payload.documentType, 40),
    subject: cleanMultilineText_(payload.subject, 500),
    from: cleanMultilineText_(payload.from, 300),
    to: cleanMultilineText_(payload.to, 300),
    applicantName: cleanText_(payload.applicantName, 150),
    unit: cleanText_(payload.unit, 200),
    email: cleanText_(payload.email, 254).toLowerCase(),
    fileUrl: cleanText_(payload.fileUrl, 500)
  };
}

function validateAdminPayload_(edited) {
  if (!(edited.timestamp instanceof Date) || isNaN(edited.timestamp.getTime())) {
    throw new Error('Tanggal dan waktu tidak valid.');
  }
  if (!isPositiveInteger_(edited.number)) {
    throw new Error('Nomor surat harus berupa bilangan bulat positif.');
  }
  if (!DOCUMENT_TYPES[edited.documentType]) {
    throw new Error('Jenis surat tidak valid.');
  }
  if (!edited.subject) {
    throw new Error('Perihal wajib diisi.');
  }
  if (!edited.applicantName) {
    throw new Error('Nama pemohon wajib diisi.');
  }
  if (UNIT_OPTIONS.indexOf(edited.unit) === -1) {
    throw new Error('Unit kerja tidak valid.');
  }
  if (edited.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(edited.email)) {
    throw new Error('Format email tidak valid.');
  }
  if (edited.fileUrl && !isGoogleDriveOrWorkspaceUrl_(edited.fileUrl)) {
    throw new Error(
      'Link alih media harus berupa tautan Google Drive atau Google Workspace.'
    );
  }

  if (DOCUMENT_TYPES[edited.documentType].requiresRouting) {
    if (!edited.from || !edited.to) {
      throw new Error(
        'Kolom Dari dan Kepada wajib diisi untuk Surat Dinas atau Nota Dinas.'
      );
    }
  }
}

function isGoogleDriveOrWorkspaceUrl_(value) {
  var url = String(value || '').trim();
  return /^https:\/\/(?:drive|docs)\.google\.com\//i.test(url);
}

function parseAdminDate_(value) {
  var text = String(value || '').trim();
  var match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(text);
  if (!match) {
    return new Date('invalid');
  }

  try {
    // Date(year, month, ...) mengikuti zona waktu runtime V8 dan dapat
    // menggeser jam. Utilities.parseDate memakai zona waktu aplikasi secara
    // eksplisit sehingga nilai yang tampil di form tersimpan tanpa perubahan.
    return Utilities.parseDate(
      text.replace('T', ' '),
      APP.TIMEZONE,
      'yyyy-MM-dd HH:mm:ss'
    );
  } catch (error) {
    return new Date('invalid');
  }
}

function formatAdminDate_(value) {
  var date = value instanceof Date ? value : new Date(value);
  return Utilities.formatDate(date, APP.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
}

function assertUniqueNumber_(sheet, number, documentType, year, excludedRow) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return;
  }

  // Mencari lewat TextFinder hanya pada kolom Nomor Surat, bukan membaca
  // seluruh baris data ke memori. Hanya baris yang nomornya benar-benar
  // cocok yang kemudian diperiksa jenis surat dan tahunnya.
  var numberColumn = sheet.getRange(2, 2, lastRow - 1, 1);
  var matches = numberColumn.createTextFinder(String(number))
    .matchEntireCell(true)
    .useRegularExpression(false)
    .findAll();

  for (var i = 0; i < matches.length; i++) {
    var rowNumber = matches[i].getRow();
    if (rowNumber === excludedRow) {
      continue;
    }

    var rowMeta = sheet.getRange(rowNumber, 3, 1, 11).getValues()[0];
    var rowDocumentType = String(rowMeta[0] || '');
    var rowYear = Number(rowMeta[10]);

    if (rowDocumentType === documentType && rowYear === year) {
      throw new Error(
        'Nomor ' + number + ' untuk ' + documentType +
        ' pada tahun ' + year + ' sudah digunakan di baris ' + rowNumber + '.'
      );
    }
  }
}

function keepCounterAheadOfEdit_(documentType, number, year) {
  var currentYear = Number(
    Utilities.formatDate(new Date(), APP.TIMEZONE, 'yyyy')
  );
  if (Number(year) !== currentYear) {
    return;
  }

  var settings = getSettings_();
  if (Number(settings.values.COUNTER_YEAR) !== currentYear) {
    settings = resetCountersForNewYearIfNeeded_(settings, currentYear);
  }

  var counterKey = DOCUMENT_TYPES[documentType].counterKey;
  var nextNumber = Number(settings.values[counterKey]);
  if (number >= nextNumber) {
    var update = {};
    update[counterKey] = number + 1;
    setSettingValues_(update);
  }
}

function buildEditLogRows_(oldValues, newValues, reason, adminEmail) {
  var rows = [];
  var timestamp = new Date();
  var requestId = String(oldValues[11] || '');
  var number = newValues[1];

  for (var i = 0; i < ADMIN_EDITABLE_COLUMNS.length; i++) {
    var column = ADMIN_EDITABLE_COLUMNS[i];
    var oldValue = formatLogValue_(oldValues[column.index]);
    var newValue = formatLogValue_(newValues[column.index]);
    if (oldValue !== newValue) {
      rows.push([
        timestamp,
        requestId,
        number,
        'KOREKSI',
        column.label,
        oldValue,
        newValue,
        reason,
        adminEmail
      ]);
    }
  }

  if (!rows.length) {
    throw new Error('Tidak ada perubahan data yang perlu disimpan.');
  }
  return rows;
}

function formatLogValue_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, APP.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  }
  return String(value === null || value === undefined ? '' : value);
}

function assertAdmin_() {
  var email = '';
  try {
    email = Session.getActiveUser().getEmail() || '';
  } catch (error) {
    email = '';
  }

  if (email.toLowerCase() !== APP.ADMIN_EMAIL.toLowerCase()) {
    throw new Error(
      'Fitur ini hanya dapat digunakan oleh akun admin ' + APP.ADMIN_EMAIL + '.'
    );
  }
  return email;
}
