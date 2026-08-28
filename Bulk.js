/**
 * Mode Massal: memungkinkan admin membuatkan banyak nomor surat sekaligus
 * untuk satu pemohon (mis. 20-40 sekaligus) tanpa mengisi ulang field yang
 * sama dan tanpa antre lock satu per satu seperti form publik biasa.
 *
 * Diakses lewat gerbang kode rahasia (BULK_ACCESS_CODE di tab PENGATURAN,
 * bisa diganti admin sendiri kapan saja) karena form ini ANYONE_ANONYMOUS
 * sehingga tidak bisa mengandalkan deteksi email admin seperti menu
 * Spreadsheet. Kode diverifikasi di server; berhasil menghasilkan token
 * bertanda tangan (mirip token edit admin) yang berlaku 2 jam.
 *
 * Setelah nomor dibuat, upload file tetap lewat uploadDraft() yang sama
 * persis dengan alur satu-nomor biasa -- baris yang dibuat Mode Massal
 * berstatus MENUNGGU_UPLOAD seperti biasa, jadi tidak ada duplikasi logika.
 */

function verifyBulkAccessCode(payload) {
  var code = cleanText_(payload && payload.code, 100);
  if (!code) {
    throw new Error('Kode akses wajib diisi.');
  }

  var settings = getSettings_();
  var expected = String(settings.values.BULK_ACCESS_CODE || '');
  if (!expected || !constantTimeEquals_(code, expected)) {
    throw new Error('Kode akses salah.');
  }

  return { accessToken: createBulkAccessToken_() };
}

/**
 * Tahap 1 Mode Massal: reservasi N nomor sekaligus dan tulis N baris dalam
 * satu kali penulisan (bukan appendRow berkali-kali), sehingga lock hanya
 * dipegang sesaat walau jumlahnya puluhan.
 */
function reserveBulkRequests(payload) {
  if (!payload) {
    throw new Error('Data permintaan tidak ditemukan. Silakan muat ulang halaman.');
  }

  validateBulkAccessToken_(payload.accessToken);

  var common = normalizeBulkCommonFields_(payload);
  validateBulkCommonFields_(common);

  var items = normalizeBulkItems_(payload.items);
  if (!items.length) {
    throw new Error('Isi minimal 1 baris Perihal.');
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockError) {
    throw new Error(
      'Sistem sedang memproses permintaan lain. Silakan tunggu beberapa detik lalu coba lagi.'
    );
  }

  try {
    var maxItems = getBulkMaxItems_();
    if (items.length > maxItems) {
      throw new Error(
        'Maksimal ' + maxItems + ' nomor sekali generate. Kurangi jumlah baris Perihal.'
      );
    }

    var now = new Date();
    var year = Number(Utilities.formatDate(now, APP.TIMEZONE, 'yyyy'));
    var settings = getSettings_();
    settings = resetCountersForNewYearIfNeeded_(settings, year);

    var typeConfig = DOCUMENT_TYPES[common.documentType];
    var startNumber = reserveNextNumbers_(settings, typeConfig.counterKey, items.length);

    var dataSheet = getRequiredSheet_(APP.DATA_SHEET);
    var rows = [];
    var results = [];

    for (var i = 0; i < items.length; i++) {
      var reservedNumber = startNumber + i;
      var requestId = Utilities.getUuid();
      var token = Utilities.getUuid();

      rows.push([
        now,
        reservedNumber,
        common.documentType,
        items[i].subject,
        common.from,
        common.to,
        common.applicantName,
        common.unit,
        getDetectedEmail_(),
        '',
        REQUEST_STATUS.WAITING_UPLOAD,
        requestId,
        year,
        '',
        '',
        token,
        getTemporaryUserKey_(),
        now
      ]);

      results.push({
        index: i,
        subject: items[i].subject,
        number: reservedNumber,
        requestId: requestId,
        token: token
      });
    }

    var lastRow = dataSheet.getLastRow();
    dataSheet.getRange(lastRow + 1, 1, rows.length, REQUEST_HEADERS.length)
      .setValues(rows);

    SpreadsheetApp.flush();

    return {
      success: true,
      items: results
    };
  } catch (error) {
    throw new Error(toUserSafeError_(error));
  } finally {
    lock.releaseLock();
  }
}

function reserveNextNumbers_(settings, counterKey, count) {
  var number = Number(settings.values[counterKey]);
  if (!isPositiveInteger_(number)) {
    throw new Error(
      'Nilai counter ' + counterKey + ' tidak valid. Hubungi admin Bagian Umum.'
    );
  }

  var counterRow = settings.rowByKey[counterKey];
  if (!counterRow) {
    throw new Error('Kunci pengaturan "' + counterKey + '" tidak ditemukan.');
  }

  settings.sheet.getRange(counterRow, 2).setValue(number + count);
  settings.values[counterKey] = number + count;
  return number;
}

function getBulkMaxItems_() {
  var settings = getSettings_();
  var value = Number(settings.values.BULK_MAX_ITEMS);
  return isPositiveInteger_(value) ? value : 100;
}

function normalizeBulkCommonFields_(payload) {
  return {
    documentType: cleanText_(payload.documentType, 40),
    from: cleanMultilineText_(payload.from, 300),
    to: cleanMultilineText_(payload.to, 300),
    applicantName: cleanText_(payload.applicantName, 150),
    unit: cleanText_(payload.unit, 200)
  };
}

function validateBulkCommonFields_(common) {
  if (!DOCUMENT_TYPES[common.documentType]) {
    throw new Error('Jenis surat tidak valid.');
  }
  if (!common.applicantName) {
    throw new Error('Nama pemohon wajib diisi.');
  }
  if (UNIT_OPTIONS.indexOf(common.unit) === -1) {
    throw new Error('Unit kerja tidak valid.');
  }

  if (DOCUMENT_TYPES[common.documentType].requiresRouting) {
    if (!common.from) {
      throw new Error('Kolom Dari wajib diisi untuk jenis surat ini.');
    }
    if (!common.to) {
      throw new Error('Kolom Kepada wajib diisi untuk jenis surat ini.');
    }
  } else {
    common.from = '';
    common.to = '';
  }
}

function normalizeBulkItems_(rawItems) {
  var list = Array.isArray(rawItems) ? rawItems : [];
  var items = [];

  for (var i = 0; i < list.length; i++) {
    var subject = cleanMultilineText_(list[i] && list[i].subject, 500);
    if (subject) {
      items.push({ subject: subject });
    }
  }

  return items;
}

function createBulkAccessToken_() {
  var now = new Date().getTime();
  var sessionData = {
    version: 1,
    issuedAt: now,
    expiresAt: now + (2 * 60 * 60 * 1000),
    nonce: Utilities.getUuid()
  };
  var body = encodeBase64WebSafe_(
    Utilities.newBlob(JSON.stringify(sessionData)).getBytes()
  );
  var signature = signBulkAccessBody_(body);
  return body + '.' + signature;
}

function validateBulkAccessToken_(token) {
  var value = cleanText_(token, 400);
  if (!value) {
    throw new Error('Sesi Mode Massal tidak ditemukan. Masukkan kembali kode akses.');
  }

  var parts = value.split('.');
  if (parts.length !== 2) {
    throw new Error('Sesi Mode Massal tidak valid. Masukkan kembali kode akses.');
  }

  var sessionData;
  try {
    var expectedSignature = signBulkAccessBody_(parts[0]);
    if (!constantTimeEquals_(expectedSignature, parts[1])) {
      throw new Error('signature');
    }
    sessionData = JSON.parse(
      Utilities.newBlob(
        Utilities.base64DecodeWebSafe(parts[0])
      ).getDataAsString()
    );
  } catch (error) {
    throw new Error('Sesi Mode Massal tidak valid. Masukkan kembali kode akses.');
  }

  if (Number(sessionData.expiresAt) < new Date().getTime()) {
    throw new Error('Sesi Mode Massal telah berakhir. Masukkan kembali kode akses.');
  }
}

function signBulkAccessBody_(body) {
  return encodeBase64WebSafe_(
    Utilities.computeHmacSha256Signature(
      String(body),
      getOrCreateBulkAccessSecret_(),
      Utilities.Charset.UTF_8
    )
  );
}

function getOrCreateBulkAccessSecret_() {
  var properties = PropertiesService.getScriptProperties();
  var propertyName = 'BULK_ACCESS_SIGNING_SECRET_V1';
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
