const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const fixture=fs.readFileSync(path.join(__dirname,'reservations.cjs'),'utf8').split('let passed=0;')[0];
const harness=vm.createContext({require,__dirname,console});
vm.runInContext(fixture+';globalThis.fixture={ctx,sheets,reset,Sheet,day};',harness);
const {ctx,sheets,reset:baseReset,Sheet,day}=harness.fixture;
vm.runInContext(fs.readFileSync(path.join(__dirname,'../FinalLetters.js'),'utf8'),ctx);
const files={},folders={};let fileNo=0,afterCreate=null;
ctx.Utilities.DigestAlgorithm={SHA_256:'sha256'};
ctx.Utilities.computeDigest=(_,bytes)=>Array.from(crypto.createHash('sha256').update(Buffer.from(bytes.map(x=>(x+256)%256))).digest());
ctx.Utilities.base64Encode=bytes=>Buffer.from(bytes).toString('base64');
ctx.validateBulkAccessToken_=token=>{if(token!=='admin-test')throw Error('Sesi admin tidak valid');};
ctx.DriveApp={Access:{PRIVATE:'PRIVATE'},Permission:{VIEW:'VIEW'},getFolderById:id=>folders[id],getFileById:id=>files[id]};
function folder(id,sharing='PRIVATE') {return folders[id]={id,sharing,getSharingAccess(){return this.sharing;},createFile(blob){const id='file-'+ ++fileNo;const f=files[id]={id,name:blob.getName(),trashed:false,getId(){return id;},getName(){return this.name;},setName(n){this.name=n;},setSharing(a){assert.equal(a,'PRIVATE');},setTrashed(v){this.trashed=v;}};if(afterCreate)afterCreate(f);return f;}};}
ctx.getOrCreateFolder_=(parent,name)=>folder(parent.id+'/'+name);
function request(id,name='Pemohon A',type='Surat Dinas',status='AKTIF',number=1){let r=Array(21).fill('');r[0]=day('2026-07-31');r[1]=number;r[2]=type;r[3]='PERIHAL RAHASIA';r[6]=name;r[7]='Bagian Umum';r[9]='https://private-draft';r[10]=status;r[11]=id;r[12]=2026;r[15]='PRIVATE-TOKEN';r[18]='2026-07-31';r[19]='MUNDUR';r[20]=day('2026-09-22');return r;}
function reset(){baseReset();Object.keys(files).forEach(k=>delete files[k]);Object.keys(folders).forEach(k=>delete folders[k]);fileNo=0;afterCreate=null;sheets.SURAT_FINAL=new Sheet([Array.from(ctx.FINAL_HEADERS)]);sheets.LOG_SURAT_FINAL=new Sheet([[]]);sheets.PENGATURAN.appendRow(['FINAL_ROOT_FOLDER_ID','root']);folder('root');sheets.PERMINTAAN.appendRow(request('one'));sheets.PERMINTAAN.appendRow(request('two','A','Nota Dinas','UPLOAD_GAGAL',2));}
function pdf(text='sample'){return {getName(){return 'uji.pdf';},getBytes(){return Array.from(Buffer.from('%PDF-1.7\n'+text));}};}
function upload(id='one',blob=pdf(),adminToken){return ctx.uploadFinalLetter({finalRequestId:id,finalPdf:blob,adminToken});}
let passed=0;function test(name,fn){reset();fn();passed++;console.log('PASS '+name);}
test('public response is an allowlist without subjects, drafts, final links, tokens, or units',()=>{
 const r=ctx.publicFinalLetters({applicantName:'Pemohon A'});assert.equal(r.items.length,1);assert.equal(Object.keys(r.items[0]).sort().join(','),'complete,documentType,letterDate,number,requestId,requestedAt');
 const s=JSON.stringify(r);for(const key of ['RAHASIA','private-draft','PRIVATE-TOKEN','Bagian Umum'])assert(!s.includes(key));
 assert.equal(r.items[0].requestedAt.slice(0,10),'2026-09-22');assert.equal(r.items[0].letterDate,'2026-07-31');
});
test('nicknames remain separate and all three document types are eligible',()=>{
 sheets.PERMINTAAN.appendRow(request('three','Pemohon A','SK/SE','AKTIF',3));const names=ctx.publicFinalLetters({}).names;assert(names.includes('A'));assert(names.includes('Pemohon A'));assert.equal(ctx.publicFinalLetters({applicantName:'Pemohon A'}).total,2);
});
test('cancelled, unused slots, allocation failures, and legacy placeholders are excluded',()=>{
 for(const status of ['DIBATALKAN','SLOT_TERSEDIA','GAGAL'])sheets.PERMINTAAN.appendRow(request(status,'Pemohon A','Surat Dinas',status));const r=request('placeholder');r[3]='Slot Kosong';sheets.PERMINTAAN.appendRow(r);assert.equal(ctx.publicFinalLetters({applicantName:'Pemohon A'}).total,1);
});
test('upload stores a private final without changing request or draft status',()=>{
 const before=JSON.stringify(sheets.PERMINTAAN.rows);const r=upload();assert.equal(r.success,true);assert.equal(JSON.stringify(sheets.PERMINTAAN.rows),before);assert.equal(ctx.publicFinalLetters({applicantName:'Pemohon A'}).items[0].complete,true);assert.equal(Object.values(files).filter(f=>!f.trashed).length,1);
});
test('failed draft does not prevent final completion',()=>{upload('two');assert.equal(ctx.publicFinalLetters({applicantName:'A'}).items[0].complete,true);assert.equal(sheets.PERMINTAAN.rows[2][10],'UPLOAD_GAGAL');});
test('one PDF cannot be attached to two numbers',()=>{upload();assert.throws(()=>upload('two'),/PDF yang sama/);});
test('identical retry is idempotent and public replacement is rejected',()=>{upload();upload();assert.equal(fileNo,1);assert.throws(()=>upload('one',pdf('different')),/Penggantian hanya/);});
test('server rejects empty, oversized, wrong-extension, and non-PDF files',()=>{
 const bad=[{getName:()=> 'x.pdf',getBytes:()=>[]},{getName:()=> 'x.pdf',getBytes:()=>new Array(20*1024*1024+1).fill(0)},{getName:()=> 'x.docx',getBytes:()=>pdf().getBytes()},{getName:()=> 'x.pdf',getBytes:()=>[1,2,3]}];for(const b of bad)assert.throws(()=>upload('one',b));assert.equal(fileNo,0);
});
test('exactly 20 MiB PDF is accepted by validation',()=>{
 const bytes=new Array(20*1024*1024).fill(32);Array.from(Buffer.from('%PDF-1.7')).forEach((b,i)=>bytes[i]=b);assert.equal(ctx.validateFinalPdf_({getName:()=> 'max.pdf',getBytes:()=>bytes}).size,20*1024*1024);
});
test('a simultaneous upload cannot claim the same number',()=>{
 const data=ctx.validateFinalPdf_(pdf());ctx.claimFinal_('one',data,false);assert.throws(()=>ctx.claimFinal_('one',data,false),/sedang diunggah/);
});
test('a stale upload claim can be recovered without replacing a newer claim',()=>{
 const data=ctx.validateFinalPdf_(pdf());const first=ctx.claimFinal_('one',data,false);sheets.SURAT_FINAL.rows[1][8]=day('2020-01-01');const second=ctx.claimFinal_('one',data,false);assert.notEqual(first.claim,second.claim);
});
test('cancellation during file creation leaves no completed final or active orphan',()=>{
 afterCreate=()=>{sheets.PERMINTAAN.rows[1][10]='DIBATALKAN';};assert.throws(()=>upload(),/belum berhasil/);assert.equal(sheets.SURAT_FINAL.rows[1][1],'');assert.equal(Object.values(files)[0].trashed,true);assert.equal(sheets.SURAT_FINAL.rows[1][7],'');
});
test('only a valid admin session can replace and view final URLs',()=>{
 upload();assert.throws(()=>upload('one',pdf('replacement'),'invalid'),/Sesi/);upload('one',pdf('replacement'),'admin-test');assert.equal(files['file-1'].trashed,true);assert.equal(files['file-2'].trashed,false);assert.equal(sheets.SURAT_FINAL.rows[1][9],2);const report=ctx.adminFinalLetters({accessToken:'admin-test'});assert(report.items[0].fileUrl.includes('file-2'));assert.throws(()=>ctx.adminFinalLetters({accessToken:''}),/Sesi/);
});
test('failed admin replacement preserves old file and old hash',()=>{
 upload();const hash=sheets.SURAT_FINAL.rows[1][6];afterCreate=()=>{throw Error('Drive failed');};assert.throws(()=>upload('one',pdf('new'),'admin-test'),/belum berhasil/);assert.equal(sheets.SURAT_FINAL.rows[1][1],'file-1');assert.equal(sheets.SURAT_FINAL.rows[1][6],hash);assert.equal(files['file-1'].trashed,false);
});
test('admin correction clears completeness with a mandatory reason and audit record',()=>{
 upload();assert.throws(()=>ctx.adminRemoveFinal({accessToken:'admin-test',requestId:'one',reason:''}),/Alasan/);ctx.adminRemoveFinal({accessToken:'admin-test',requestId:'one',reason:'Salah file'});assert.equal(files['file-1'].trashed,true);assert.equal(ctx.publicFinalLetters({applicantName:'Pemohon A'}).items[0].complete,false);assert(sheets.LOG_SURAT_FINAL.rows.some(r=>r[2]==='FINAL_DILEPAS'));
});
test('filter period uses actual submission date instead of backdated letter date',()=>{
 upload();assert.equal(ctx.adminFinalLetters({accessToken:'admin-test',startDate:'2026-09-22',endDate:'2026-09-22'}).total,2);assert.equal(ctx.adminFinalLetters({accessToken:'admin-test',startDate:'2026-07-31',endDate:'2026-07-31'}).total,0);assert.throws(()=>ctx.adminFinalLetters({accessToken:'admin-test',startDate:'2026-09-22',endDate:'2026-01-01'}),/Rentang/);
});
test('summary counts and filters reconcile',()=>{
 upload();const report=ctx.adminFinalLetters({accessToken:'admin-test'});assert.equal(report.summary.reduce((n,g)=>n+g.total,0),report.total);assert.equal(report.summary.reduce((n,g)=>n+g.complete,0),1);assert.equal(ctx.adminFinalLetters({accessToken:'admin-test',status:'incomplete'}).total,1);assert.equal(ctx.adminFinalLetters({accessToken:'admin-test',applicantName:'A',documentType:'Nota Dinas',unit:'Bagian Umum',year:2026}).total,1);
});
test('public lists paginate without losing a matching request',()=>{
 for(let i=0;i<55;i++)sheets.PERMINTAAN.appendRow(request('extra'+i,'Pemohon A'));const a=ctx.publicFinalLetters({applicantName:'Pemohon A',page:0}),b=ctx.publicFinalLetters({applicantName:'Pemohon A',page:1});assert.equal(a.total,56);assert.equal(a.items.length,50);assert.equal(b.items.length,6);assert.equal(new Set(a.items.concat(b.items).map(r=>r.requestId)).size,56);
});
test('non-private final root fails closed and can be retried after repair',()=>{
 folders.root.sharing='ANYONE';assert.throws(()=>upload(),/belum berhasil/);assert.equal(sheets.SURAT_FINAL.rows[1][1],'');folders.root.sharing='PRIVATE';upload();assert.equal(ctx.publicFinalLetters({applicantName:'Pemohon A'}).items[0].complete,true);
});
test('export rejects missing admin sessions and unsupported formats',()=>{assert.throws(()=>ctx.exportFinalReport({accessToken:'bad',format:'pdf'}),/Sesi/);assert.throws(()=>ctx.exportFinalReport({accessToken:'admin-test',format:'exe'}),/Format/);});
console.log(passed+' final-letter scenarios passed.');
