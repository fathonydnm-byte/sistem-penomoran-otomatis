const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
assert.equal(JSON.parse(read('.clasp.json')).scriptId,'1a105dbVLfTVRwogvyvA4TIk5QmZnBLmUVnk1SoUxCBU_KEHmg28tv29_');
assert.equal(JSON.parse(read('appsscript.json')).webapp.access,'ANYONE_ANONYMOUS');
assert(!fs.existsSync(path.join(root,'Staging.js')));
for(const file of ['Code.js','FinalLetters.js','FinalStorage.js','FinalLettersUI.html'])assert(!/bindFinalStaging_|ensureFinalStaging_|stagingDummyPdf|staging-banner|finalDummyA|DATA BUATAN|UJI-SIDDIQ/.test(read(file)),file);
for(const file of ['Code.js','Bulk.js','Admin.js','Reservations.js','Archive.js','FinalLetters.js','FinalStorage.js','FinalUpload.js'])new vm.Script(read(file));
for(const file of ['Index.html','FinalLettersUI.html','FinalUploadClient.html','LetterCodes.html'])for(const s of read(file).matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(s[1]);
const props={},files={},sheets={};let locked=false,copyCount=0,createCount=0,failSetup=false;
function sheet(){let rows=[];return{getLastRow:()=>rows.length,getRange(){return{getValues:()=>rows,setValues(v){rows=v;}}},setFrozenRows(){}};}
const book={getSheetByName:n=>sheets[n],insertSheet(n){return sheets[n]=sheet();},setSpreadsheetTimeZone(){}};
files.source={makeCopy(){assert(!locked,'Drive copy must not block numbering');copyCount++;return files.backup;}};
files.backup={getId:()=> 'backup',setSharing(){}};
files.ledger={moveTo(){assert(!locked);if(failSetup)throw Error('temporary Drive failure');},getSharingAccess:()=> 'PRIVATE'};
const ctx=vm.createContext({console,APP:{SPREADSHEET_ID:'source',TIMEZONE:'Asia/Jakarta'},FINAL_SHEET:'SURAT_FINAL',FINAL_HEADERS:['ID','File'],
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty(k,v){props[k]=v;},deleteProperty(k){delete props[k];}})},
 Utilities:{getUuid:()=> 'claim',formatDate:()=> '2026-11-04'},
 LockService:{getScriptLock:()=>({waitLock(){assert(!locked);locked=true;},releaseLock(){locked=false;}})},
 DriveApp:{Access:{PRIVATE:'PRIVATE'},Permission:{VIEW:'VIEW'},getFileById:id=>files[id],createFolder(){assert(!locked);return{getId:()=> 'root'};},getFolderById:id=>{assert.equal(id,'root');return{getSharingAccess:()=> 'PRIVATE'};}},
 SpreadsheetApp:{create(){assert(!locked);createCount++;return{getId:()=> 'ledger'};},openById(id){assert.equal(id,'ledger');return book;},flush(){}}
});
vm.runInContext(read('FinalStorage.js'),ctx);
assert.throws(()=>ctx.finalStorageConfig_(),/dipersiapkan/);
failSetup=true;assert.throws(()=>ctx.ensureFinalProduction_(),/temporary/);assert.equal(props.FINAL_PROD_READY,undefined);assert.equal(props.FINAL_PROD_SETUP_CLAIM,undefined);assert.equal(locked,false);
failSetup=false;assert.equal(ctx.ensureFinalProduction_(),true);assert.equal(ctx.ensureFinalProduction_(),true);assert.equal(copyCount,1);assert.equal(createCount,1);assert.equal(props.FINAL_PROD_READY,'1');
assert.equal(ctx.finalLedgerBook_(),book);assert.deepEqual(Object.keys(sheets).sort(),['LOG_SURAT_FINAL','SURAT_FINAL']);
assert.equal(ctx.finalStorageConfig_().rootId,'root');assert.equal(ctx.finalStorageConfig_().ledgerId,'ledger');
ctx.FINAL_LEDGER_BOOK_=null;files.ledger.getSharingAccess=()=> 'ANYONE';assert.throws(()=>ctx.finalLedgerBook_(),/privat/);
props.FINAL_PROD_READY='';props.FINAL_PROD_SETUP_UNTIL=String(Date.now()+60000);assert.equal(ctx.ensureFinalProduction_(),false);assert.equal(locked,false);
const archive=vm.createContext({finalEligible_:r=>r[10]==='AKTIF',REQUEST_STATUS:{RESERVED:'SLOT_TERSEDIA',WAITING_UPLOAD:'MENUNGGU_UPLOAD',UPLOADING:'MENGUNGGAH',UPLOAD_FAILED:'UPLOAD_GAGAL'}});
vm.runInContext(read('Archive.js'),archive);const active=Array(21).fill('');active[10]='AKTIF';active[12]=2025;assert(Number.isNaN(archive.yearFromRequestRow_(active)));active[10]='DIBATALKAN';assert.equal(archive.yearFromRequestRow_(active),2025);
console.log('PASS production target, no test fixtures, private ledger, backup/retry/idempotency, short locks, privacy failure, and annual final history.');
