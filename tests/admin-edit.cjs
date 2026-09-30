const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const adminSource = fs.readFileSync('Admin.js', 'utf8');
const ledger = {rows: []};
const context = {
  console,
  REQUEST_STATUS: {RESERVED: 'SLOT_TERSEDIA'},
  RESERVATION: {SLOTS: 'RESERVASI_NOMOR'},
  SLOT_HEADERS: new Array(9).fill(''),
  DOCUMENT_TYPES: {
    'Surat Dinas': {requiresRouting: true},
    'Nota Dinas': {requiresRouting: true},
    'SK/SE': {requiresRouting: false}
  },
  UNIT_OPTIONS: ['Bagian Umum'],
  getRequiredSheet_: () => ledger,
  reservationRows_: sheet => sheet.rows,
  reservationDateKey_: value => {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    const key = String(value || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error('invalid date');
    return key;
  },
  isPositiveInteger_: value => Number.isInteger(Number(value)) && Number(value) > 0
};

vm.createContext(context);
vm.runInContext(adminSource, context);

function request({status = 'AKTIF', id = 'REQ-1', mode = 'HARI_INI'} = {}) {
  const row = new Array(21).fill('');
  row[10] = status;
  row[11] = id;
  row[19] = mode;
  return row;
}

assert.strictEqual(
  context.findReservationLedgerRecordForAdminEdit_(request()),
  null,
  'record biasa tidak memerlukan ledger reservasi'
);

ledger.rows = [
  ['SLOT-1', '2026-09-10', 'SK/SE', 903, 'OTOMATIS', '', '', '', ''],
  ['SLOT-2', '2026-09-10', 'SK/SE', 904, 'OTOMATIS', '', 'REQ-USED', '', '']
];

assert.strictEqual(
  context.findReservationLedgerRecordForAdminEdit_(
    request({status: 'SLOT_TERSEDIA', id: 'SLOT-1', mode: 'RESERVASI'})
  ).rowNumber,
  2,
  'placeholder ditemukan lewat ID slot'
);

assert.strictEqual(
  context.findReservationLedgerRecordForAdminEdit_(
    request({id: 'REQ-USED', mode: 'MUNDUR'})
  ).rowNumber,
  3,
  'permintaan mundur ditemukan lewat ID pemakai'
);

assert.throws(
  () => context.findReservationLedgerRecordForAdminEdit_(
    request({id: 'REQ-MISSING', mode: 'MUNDUR'})
  ),
  /Indeks reservasi tidak ditemukan/,
  'edit diblokir jika ledger reservasi hilang'
);

assert.throws(
  () => context.assertUniqueReservationLedgerIdentity_(
    ledger,
    '2026-09-10',
    'SK/SE',
    904,
    2
  ),
  /sudah ada di indeks reservasi/,
  'identitas ledger duplikat ditolak'
);

context.assertUniqueReservationLedgerIdentity_(
  ledger,
  '2026-09-10',
  'SK/SE',
  904,
  3
);

const placeholderPayload = {
  timestamp: vm.runInContext("new Date('2026-09-10T08:00:00Z')", context),
  number: 903,
  documentType: 'SK/SE',
  subject: 'Slot Kosong',
  from: '',
  to: '',
  applicantName: '',
  unit: '',
  email: '',
  fileUrl: ''
};
context.validateAdminPayload_(placeholderPayload, true);
assert.throws(
  () => context.validateAdminPayload_(placeholderPayload, false),
  /Nama pemohon wajib/,
  'record biasa tetap mewajibkan identitas pemohon'
);

const html = fs.readFileSync('EditDialog.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace('<?= rowNumber ?>', '2')
  .replace('<?!= initialDataJson ?>', '{}')
  .replace('<?!= adminEditUrlJson ?>', '""');
new Function(script);

assert(!adminSource.includes('Identitas nomor reservasi tidak boleh diubah'));
assert(adminSource.includes('newValues[18] = editedLetterDate'));

console.log('PASS admin edit supports regular, backdated, and reservation records safely.');
