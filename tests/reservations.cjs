const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
let now = new Date('2026-09-22T01:00:00Z');
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } }
class Sheet {
  constructor(rows = [[]]) { this.rows = rows; this.failAppend = false; }
  getLastRow() { return this.rows.length; }
  appendRow(r) { if (this.failAppend) { this.failAppend=false; throw Error('injected write failure'); } this.rows.push(r.slice()); }
  getRange(row,col,height=1,width=1) {
    const s = this;
    return {
      getValues() { return Array.from({length:height}, (_,i)=>Array.from({length:width},(_,j)=>s.rows[row-1+i]?.[col-1+j] ?? '')); },
      setValues(v) { assert.equal(v.length,height); v.forEach((r,i)=>{assert.equal(r.length,width); s.rows[row-1+i] ||= []; r.forEach((x,j)=>s.rows[row-1+i][col-1+j]=x);}); },
      setValue(v) { s.rows[row-1] ||= []; s.rows[row-1][col-1]=v; },
      createTextFinder(value) { return {matchEntireCell(){return this;},findAll(){ return s.rows.flatMap((r,i)=> i>=row-1 && i<row-1+height && String(r[col-1])===String(value) ? [{getRow:()=>i+1}] : []); }}; }
    };
  }
}
const sheets = {};
const props = {};
let uuid = 0, locked = false;
const ctx = vm.createContext({console, Date:Clock,
  Utilities:{getUuid:()=> 'uuid-'+ ++uuid,formatDate(d,tz,fmt){let key=new Date(+d+7*3600000).toISOString().slice(0,10); return fmt==='yyyy'?key.slice(0,4):key;}},
  SpreadsheetApp:{flush(){}},
  LockService:{getScriptLock(){return {waitLock(){assert.equal(locked,false);locked=true;},releaseLock(){locked=false;}};}},
  PropertiesService:{getScriptProperties(){return {getProperty:k=>props[k]||null,setProperty(k,v){props[k]=v;},deleteProperty(k){delete props[k];}};}}
});
for (const file of ['Code.js','Bulk.js','Reservations.js','Archive.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
ctx.getSpreadsheet_=()=>({getSheetByName:n=>sheets[n]});
ctx.getRequiredSheet_=n=>{if(!sheets[n]) throw Error(n);return sheets[n];};
ctx.getDetectedEmail_=()=>''; ctx.getTemporaryUserKey_=()=>'';
ctx.toUserSafeError_=e=>e.message;
function reset() {
  Object.keys(props).forEach(k=>delete props[k]);
  sheets.PERMINTAAN=new Sheet(); sheets.RESERVASI_NOMOR=new Sheet(); sheets.LOG_PERMINTAAN=new Sheet(); sheets.LOG_PERUBAHAN=new Sheet();
  sheets.HARI_LIBUR=new Sheet();
  sheets.PENGATURAN=new Sheet([[],['COUNTER_YEAR',2026],['NEXT_SURAT_DINAS',41],['NEXT_NOTA_DINAS',100],['NEXT_SK_SE',200]]);
  sheets.KONFIGURASI_RESERVASI=new Sheet([[],['AKTIF',true],['MULAI_TANGGAL','2026-09-21'],['Surat Dinas',4],['Nota Dinas',4],['SK/SE',4],['TAHUN_KALENDER_DIVERIFIKASI','2026,2027']]);
}
function day(key){return new Clock(key+'T00:00:00+07:00');}
let passed=0;
function test(name,fn){reset();fn();passed++;console.log('PASS '+name);}
const payload = {documentType:'Surat Dinas',subject:'Surat uji',from:'A',to:'B',applicantName:'Pemohon',unit:'Bagian Umum',requestToken:'token-test',draftName:'uji.pdf',draftSize:10};
test('daily 12 slots and repeated invocation does not advance counters',()=>{
 ctx.ensureDailyReservations_(day('2026-09-21'));ctx.ensureDailyReservations_(day('2026-09-21'));
 assert.equal(sheets.PERMINTAAN.rows.length,13);assert.equal(ctx.getSettings_().values.NEXT_SURAT_DINAS,45);
});
test('weekends and national holidays excluded; joint leave remains working day',()=>{
 sheets.HARI_LIBUR.appendRow(['2026-09-21','Fixture holiday']);
 ctx.ensureDailyReservations_(day('2026-09-21'));ctx.ensureDailyReservations_(day('2026-09-26'));
 assert.equal(sheets.PERMINTAAN.rows.length,1);
 ctx.ensureDailyReservations_(day('2026-09-22'));assert.equal(sheets.PERMINTAAN.rows.length,13);
});
test('before activation date produces no retroactive slots',()=>{ctx.ensureDailyReservations_(day('2026-09-18'));assert.equal(sheets.PERMINTAAN.rows.length,1);});
test('normal request creates daily slots first and takes next number',()=>{
 const result=ctx.reserveRequest(payload);assert.equal(result.number,45);assert.equal(sheets.PERMINTAAN.rows.length,14);
});
test('backdate consumes smallest slot; duplicate token keeps same identity',()=>{
 ctx.ensureDailyReservations_(day('2026-09-21'));
 const a=ctx.reserveRequest({...payload,letterDate:'2026-09-21'});
 const b=ctx.reserveRequest({...payload,letterDate:'2026-09-21'});
 assert.equal(a.number,41);assert.equal(b.requestId,a.requestId);
 const claimed=sheets.PERMINTAAN.rows.find(r=>r[11]===a.requestId);
 assert.equal(ctx.reservationDateKey_(claimed[0]),'2026-09-21');
 assert.equal(ctx.reservationDateKey_(claimed[20]),'2026-09-22');
 assert.equal(ctx.availableSlots_('Surat Dinas','2026-09-21').length,3);
 assert.equal(ctx.getSettings_().values.NEXT_SURAT_DINAS,45);
 const c=ctx.reserveRequest({...payload,requestToken:'other',letterDate:'2026-09-21'});assert.equal(c.number,42);
});
test('used slot remains unavailable after upload failure',()=>{
 ctx.ensureDailyReservations_(day('2026-09-21'));const a=ctx.reserveRequest({...payload,letterDate:'2026-09-21'});
 ctx.markPendingUploadFailure_(a.requestId,payload.requestToken,Error('offline'));
 assert.equal(ctx.availableSlots_('Surat Dinas','2026-09-21').length,3);
 assert.equal(ctx.reserveRequest({...payload,letterDate:'2026-09-21'}).number,41);
});
test('today, future and invalid dates rejected',()=>{
 ['2026-09-22','2026-09-23','2026-02-30','wrong'].forEach(d=>assert.throws(()=>ctx.validateBackdate_(d)));
});
test('exhausted slot does not increment counter',()=>{
 assert.throws(()=>ctx.reserveRequest({...payload,letterDate:'2026-09-20'}),/tidak tersedia/);
 assert.equal(ctx.getSettings_().values.NEXT_SURAT_DINAS,41);
});
test('write failure resumes same allocation plan without losing or duplicating slots',()=>{
 sheets.PERMINTAAN.failAppend=true;
 assert.throws(()=>ctx.ensureDailyReservations_(day('2026-09-21')));
 ctx.ensureDailyReservations_(day('2026-09-21'));
 assert.equal(sheets.PERMINTAAN.rows.length,13);assert.equal(ctx.getSettings_().values.NEXT_SURAT_DINAS,45);
});
test('old slots survive archive and use old year without resetting current counter',()=>{
 ctx.ensureDailyReservations_(day('2026-09-21'));
 assert.ok(Number.isNaN(ctx.yearFromRequestRow_(sheets.PERMINTAAN.rows[1])));
 now=new Date('2027-01-04T01:00:00Z');
 ctx.ensureDailyReservations_(new Clock());
 const before=ctx.getSettings_().values.NEXT_SURAT_DINAS;
 ctx.reserveRequest({...payload,letterDate:'2026-09-21'});
 assert.equal(ctx.getSettings_().values.COUNTER_YEAR,2027);
 assert.equal(ctx.getSettings_().values.NEXT_SURAT_DINAS,before);
 now=new Date('2026-09-22T01:00:00Z');
});
test('missing holiday calendar blocks unverified allocation',()=>{
 sheets.KONFIGURASI_RESERVASI.rows[6][1]='2025';
 assert.throws(()=>ctx.ensureDailyReservations_(day('2026-09-21')),/belum diverifikasi/);
 assert.equal(sheets.PERMINTAAN.rows.length,1);
});
test('legacy marker uses subject regardless of routing placeholders',()=>{
 const row=['',10,'Surat Dinas','Slot Kosong','', ''];assert.equal(ctx.legacyCandidate_(row),true);
 row[3]='Surat biasa';row[4]=row[5]='Slot Kosong';assert.equal(ctx.legacyCandidate_(row),false);
 row[2]='SK/SE';row[3]=' slot kosong ';row[4]=row[5]='';assert.equal(ctx.legacyCandidate_(row),true);
});
const html=fs.readFileSync(path.join(root,'Index.html'),'utf8');
for(const script of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(script[1]);
console.log(passed+' scenarios passed; client JavaScript parses.');
