const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const fixture=fs.readFileSync(path.join(__dirname,'reservations.cjs'),'utf8').split('let passed=0;')[0];
const harness=vm.createContext({require,__dirname,console});
vm.runInContext(fixture+';globalThis.fixture={ctx,sheets,reset,Sheet,day};',harness);
const {ctx,sheets,reset:baseReset,Sheet,day}=harness.fixture;
vm.runInContext(fs.readFileSync(path.join(__dirname,'../FinalLetters.js'),'utf8'),ctx);
ctx.finalLedgerBook_=()=>({getSheetByName:n=>sheets[n]});
ctx.finalStorageConfig_=()=>({rootId:'root'});
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
function pdf(text='sample'){return {name:'uji.pdf',getName(){return this.name;},setName(name){this.name=name;return this;},getBytes(){return Array.from(Buffer.from('%PDF-1.7\n'+text));}};}
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
test('request and ledger row reordering during upload still binds the final by ID',()=>{
 sheets.SURAT_FINAL.appendRow(['two','','','','','','','','',0,'']);
 afterCreate=()=>{[sheets.PERMINTAAN.rows[1],sheets.PERMINTAAN.rows[2]]=[sheets.PERMINTAAN.rows[2],sheets.PERMINTAAN.rows[1]];[sheets.SURAT_FINAL.rows[1],sheets.SURAT_FINAL.rows[2]]=[sheets.SURAT_FINAL.rows[2],sheets.SURAT_FINAL.rows[1]];};
 upload();assert.equal(sheets.SURAT_FINAL.rows.find(r=>r[0]==='one')[1],'file-1');assert.equal(sheets.SURAT_FINAL.rows.find(r=>r[0]==='two')[1],'');
});
test('a moved request cancelled during upload remains incomplete and clears its claim',()=>{
 sheets.SURAT_FINAL.appendRow(['two','','','','','','','','',0,'']);
 afterCreate=()=>{sheets.PERMINTAAN.rows[1][10]='DIBATALKAN';[sheets.PERMINTAAN.rows[1],sheets.PERMINTAAN.rows[2]]=[sheets.PERMINTAAN.rows[2],sheets.PERMINTAAN.rows[1]];[sheets.SURAT_FINAL.rows[1],sheets.SURAT_FINAL.rows[2]]=[sheets.SURAT_FINAL.rows[2],sheets.SURAT_FINAL.rows[1]];};
 assert.throws(()=>upload(),/belum berhasil/);const row=sheets.SURAT_FINAL.rows.find(r=>r[0]==='one');assert.equal(row[1],'');assert.equal(row[7],'');assert.equal(files['file-1'].trashed,true);
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
function trackSheetReads(fn){
 const reads={};for(const name of ['PERMINTAAN','SURAT_FINAL']){const sheet=sheets[name],range=sheet.getRange.bind(sheet);reads[name]=[];sheet.getRange=(...args)=>{const r=range(...args),get=r.getValues;r.getValues=()=>{reads[name].push({row:args[0],height:args[2]||1,width:args[3]||1});return get();};return r;};}
 fn(reads);
}
test('large upload scans each source once and rechecks only its two claimed rows',()=>{
 for(let i=0;i<1000;i++){sheets.PERMINTAAN.appendRow(request('bulk'+i));sheets.SURAT_FINAL.appendRow(['bulk'+i,'existing','','','','','hash'+i,'','',1,'']);}
 trackSheetReads(reads=>{upload();assert.deepEqual(reads.PERMINTAAN.map(r=>r.height),[1002,1]);assert.deepEqual(reads.SURAT_FINAL.map(r=>r.height),[1000,1]);});
 assert.equal(files['file-1'].name,sheets.SURAT_FINAL.rows.find(r=>r[0]==='one')[2]);
});
test('monitoring reads requests and ledger once for rows, summary, and applicant choices',()=>{
 sheets.SURAT_FINAL.appendRow(['one','existing','','','','','','','',1,'']);
 trackSheetReads(reads=>{const report=ctx.adminFinalLetters({accessToken:'admin-test'});assert.equal(report.total,2);assert.equal(report.names.length,2);assert.equal(reads.PERMINTAAN.length,1);assert.equal(reads.SURAT_FINAL.length,1);assert.equal(report.summary.reduce((n,g)=>n+g.complete,0),1);});
});
function finalUIHarness(){
 class Element {
   constructor(tag){this.tagName=tag;this.children=[];this.elements={};this.style={};this.value='';this.hidden=false;this._text='';}
   appendChild(child){this.children.push(child);if(child.name)this.elements[child.name]=child;return child;}
   set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text;}
   setAttribute(){}querySelector(tag){return this.children.find(c=>c.tagName===tag);}remove(){}
 }
 const elements={},calls=[];const element=id=>elements[id]||(elements[id]=new Element('div'));
 element('finalPublicPanel').hidden=true;element('finalAdminPanel').hidden=true;
 const run=new Proxy({withSuccessHandler(ok){this.ok=ok;return this;},withFailureHandler(fail){this.fail=fail;return this;}},{get(target,key){return key in target?target[key]:(payload)=>calls.push({name:key,payload,ok:target.ok,fail:target.fail});}});
 const ui=vm.createContext({document:{getElementById:element,createElement:tag=>new Element(tag)},google:{script:{run}},FinalUploadClient:{upload(o){calls.push({name:'resumableUpload',ok:o.onSuccess,fail:o.onFailure,progress:o.onProgress});}},window:{addEventListener(){},confirm:()=>true},console});
 const script=fs.readFileSync(path.join(__dirname,'../FinalLettersUI.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];vm.runInContext(script,ui);
 return {element,calls,ui};
}
test('public upload success updates its row without extra list or hidden admin requests',()=>{
 const {element,calls,ui}=finalUIHarness();
 element('finalPublicToggle').onclick();assert.equal(calls[0].name,'publicFinalLetters');calls.shift().ok({names:['Pemohon A'],items:[],total:0});
 element('finalApplicant').value='Pemohon A';element('finalApplicant').onchange();calls.shift().ok({names:['Pemohon A'],items:[{requestId:'one',number:1,documentType:'Surat Dinas',letterDate:'2026-07-31',requestedAt:'2026-09-22',complete:false}],total:1});
 const publicTable=element('finalPublicList').children[0],row=publicTable.children[1].children[0],form=row.children[4].children[0];form.elements.finalPdf.files=[{name:'final.pdf',size:100}];
 ui.FinalLettersUI.unlock('admin-test');form.onsubmit({preventDefault(){}});assert.equal(calls.length,1);assert.equal(calls[0].name,'resumableUpload');
 calls[0].progress({receivedBytes:50,totalBytes:100,percent:50,phase:'Mengirim paket',elapsedSeconds:2});
 const display=form.children.find(c=>c.className==='final-upload-progress');assert.equal(display.children[0].textContent,'50% diterima');assert.equal(display.children[1].value,50);assert.equal(display.children[1].max,100);assert.match(display.children[2].textContent,/2 detik/);
 element('finalApplicant').value='Pemohon lain';element('finalApplicant').onchange();assert.equal(element('finalApplicant').value,'Pemohon A');
 element('finalPublicToggle').onclick();assert.equal(element('finalPublicPanel').hidden,false);assert.equal(calls.length,1);
 calls.shift().ok({success:true,complete:true});
 assert.equal(calls.length,0);assert.equal(element('finalPublicMessage').textContent,'Final berhasil tersimpan.');const updated=element('finalPublicList').children[0].children[1].children[0];assert.equal(updated.children[3].textContent,'Sudah dilengkapi');assert.equal(updated.children[4].children.length,0);
});
test('an in-flight public response cannot undo a newer successful admin upload',()=>{
 const {element,calls,ui}=finalUIHarness();ui.FinalLettersUI.unlock('admin-test');
 element('finalMonitorTab').onclick();assert.equal(calls[0].name,'adminFinalLetters');
 const record={requestId:'one',applicantName:'Pemohon A',number:1,documentType:'Surat Dinas',letterDate:'2026-07-31',requestedAt:'2026-09-22',complete:false};
 calls.shift().ok({names:['Pemohon A'],units:['Bagian Umum'],items:[{...record}],summary:[{applicantName:'Pemohon A',total:1,complete:0,incomplete:1}],total:1});
 element('finalApplicant').value='Pemohon A';element('finalPublicToggle').onclick();const stale=calls.shift();assert.equal(stale.name,'publicFinalLetters');
 const row=element('finalAdminList').children[0].children[1].children[0],form=row.children[5].children[0];form.elements.finalPdf.files=[{name:'final.pdf',size:100}];
 form.onsubmit({preventDefault(){}});assert.equal(calls[0].name,'resumableUpload');calls.shift().ok({success:true,complete:true});assert.equal(calls[0].name,'adminFinalLetters');
 stale.ok({names:['Pemohon A'],items:[{...record}],total:1});const updated=element('finalPublicList').children[0].children[1].children[0];assert.equal(updated.children[3].textContent,'Sudah dilengkapi');assert.equal(updated.children[4].children.length,0);
 // A subsequent list refresh still trusts the newer server result, e.g. an admin correction elsewhere.
 element('finalPublicToggle').onclick();element('finalPublicToggle').onclick();const fresh=calls.pop();assert.equal(fresh.name,'publicFinalLetters');fresh.ok({names:['Pemohon A'],items:[{...record}],total:1});const corrected=element('finalPublicList').children[0].children[1].children[0];assert.equal(corrected.children[3].textContent,'Perlu dilengkapi final surat');
});
console.log(passed+' final-letter scenarios passed.');
