const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ctx = vm.createContext({console});
for (const file of ['LetterDraftClassification.js','LetterDrafts.js']) {
  vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
}
const signer={id:'fitri-role',code:'',name:'Nama Contoh, S.E.',short:'Nama Contoh',title:'Ketua Tim',nip:'199001012020011001'};
const rector={id:'rector-role',code:'R',title:'Rektor'};
const general={id:'general-role',code:'BU1',title:'Kepala Bagian Umum'};
const bureau={id:'bureau-role',code:'BU',title:'Plt. Kepala Biro Administrasi Umum, Perencanaan dan Keuangan'};
const master=[signer,bureau,general,rector];
const base={type:'SD',urgency:'B',date:'2026-11-09',signer:signer.id,subject:'Perihal',target:'Tujuan',body:'Isi',classification:'HM.01'};
const model=(data,officials=master)=>ctx.letterDraftModel_({...base,...data},officials,[{name:'Gedung Uji',recipient:'R'}]);
assert.equal(model({}).code,'B-[BELUM BERNOMOR]/Un.07/01//HM.01/11/2026');
assert.equal(model({behalf:true}).code,'B-[BELUM BERNOMOR]/Un.07/01/R//HM.01/11/2026');
assert.throws(()=>model({date:'2026-02-30'}),/Tanggal tidak valid/);
assert.throws(()=>model({classification:'random'}),/klasifikasi/);
const multiAddress='Sekretariat Jenderal\nJl. Lapangan Banteng Barat\ndi Jakarta';
assert.equal(model({target:multiAddress.replaceAll('\n','\r\n')}).target[0],multiAddress);
const event={start:'2026-11-09',end:'2026-11-10',time:'09.00',place:'Ruang uji',activity:'Kegiatan uji'};
assert.deepEqual(Array.from(model({type:'UNDANGAN',...event,agenda:'Rapat',recipients:['Seluruh Wakil Rektor','Wakil Rektor Bidang Akademik','Rektor','rektor']}).target),['Seluruh Wakil Rektor','Rektor']);
const recipientOptions=ctx.letterDraftRecipientOptions_([...master,{...bureau,id:'duplicate-title'}]);
assert.deepEqual(Array.from(recipientOptions,o=>o.title),[rector.title,bureau.title,signer.title,general.title]);
const invitation={type:'UNDANGAN',...event,agenda:'Rapat',recipients:[{id:bureau.id},'Penerima Luar']};
assert.deepEqual(Array.from(model(invitation).target),[bureau.title,'Penerima Luar']);
assert.throws(()=>model(invitation,[signer,rector]),/Jabatan penerima telah berubah/);
assert.throws(()=>model({signer:bureau.id}),/Penandatangan tidak valid/);
const newRector={...rector,title:'Plt. Rektor'};
assert.equal(model({type:'SK',activity:'Kegiatan'},[signer,newRector]).target[0],newRector.title);
assert.equal(model({type:'KENDARAAN',...event,contactName:'Uji',contactNumber:'0800'},[signer,{...general,title:'Plt. Kepala Bagian Umum'}]).target[0],
  'Plt. Kepala Bagian Umum Kantor Pusat UIN Sunan Ampel Surabaya');
assert.equal(model({type:'ST_SPD',...event,people:[['Nama','','','Jabatan'],['Nama II','','','Jabatan II']]}).people.length,2);
assert.throws(()=>model({type:'ST_SPD',...event,people:[['Nama','123','','Jabatan']]}),/18 digit/);
assert.equal(model({type:'GEDUNG',...event,building:'Gedung Uji',participants:'20',contactName:'Uji',contactNumber:'0800'}).target[0],'Rektor');
assert.throws(()=>model({type:'GEDUNG',...event,building:'Gedung lain'}),/Pilih gedung/);
assert.equal(model({type:'KENDARAAN',...event,contactName:'Uji',contactNumber:'0800'}).vehicles,'');
assert.match(model({type:'SK',activity:'Kegiatan'}).code,/HK\.00\.5/);
assert.equal(model({type:'KHUSUS',recipients:['Rektor']}).target[0],'Rektor');
assert.throws(()=>model({type:'UNDANGAN',...event,start:'2026-11-11',agenda:'Rapat'}),/mendahului/);
assert.equal(ctx.letterDraftPayloadKey_({date:'2026-11-09',type:'SK'},true),
  ctx.letterDraftPayloadKey_({type:'SK',date:'2026-11-09'},true));
assert.notEqual(ctx.letterDraftPayloadKey_({date:'2026-11-09',type:'SK'},true),
  ctx.letterDraftPayloadKey_({type:'SK',date:'2026-11-09'},false));
const index=fs.readFileSync('Index.html','utf8');
assert.match(index,/^<!DOCTYPE html>/i);
assert.match(index,/<\/html>\s*$/i);
assert.equal(index.split('includeLetterDrafts_()').length,2);
const html=fs.readFileSync('LetterDraftsUI.html','utf8');
for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
const props=new Map();
ctx.PropertiesService={getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})};
ctx.ScriptApp={getScriptId:()=> 'unrelated'};
assert.throws(()=>ctx.letterDraftGuard_(),/sedang dipersiapkan/);
ctx.ScriptApp.getScriptId=()=> '1a105dbVLfTVRwogvyvA4TIk5QmZnBLmUVnk1SoUxCBU_KEHmg28tv29_';
props.set('LETTER_DRAFT_ENABLED','0');
assert.throws(()=>ctx.letterDraftGuard_(),/sedang dipersiapkan/);
props.delete('LETTER_DRAFT_ENABLED');
assert.equal(ctx.letterDraftGuard_().staging,false);
ctx.SpreadsheetApp={openById:id=>{assert.equal(id,'1UR8puYkKdOKyMEqBbXYgBei1hNCvPSoMjGFkxTSgNhM');return {getSheetByName:()=>null};}};
assert.equal(ctx.letterDraftBuildings_(ctx.letterDraftGuard_()).length,0);
assert.throws(()=>ctx.letterDraftOfficials_(ctx.letterDraftGuard_()),/Master pejabat belum tersedia/);

// A sharing failure after allocation must be retried against the same file and number.
Object.assign(ctx.ScriptApp,{getAuthorizationInfo:()=>({getAuthorizationStatus:()=> 'READY'}),
  AuthMode:{FULL:'FULL'},AuthorizationStatus:{REQUIRED:'REQUIRED'}});
ctx.letterDraftOfficials_=()=>[signer];
ctx.letterDraftRender_=()=>{};
ctx.reservationDateKey_=()=> '2026-11-09';
ctx.cleanText_=v=>v;
ctx.validatePublicFields_=p=>assert.equal(p.applicantName,'Pemohon Uji');
ctx.letterDraftLock_=fn=>fn();
ctx.Utilities={base64EncodeWebSafe:value=>value,computeDigest:(_,value)=>value,DigestAlgorithm:{SHA_256:'sha256'}};
ctx.MimeType={PDF:'application/pdf'};
ctx.DriveApp={Access:{ANYONE_WITH_LINK:'link'},Permission:{EDIT:'edit'}};
ctx.finalRoot_=()=>({name:'private'});
ctx.finalPrivateChild_=(folder,name)=>{assert.equal(folder.name,'private');assert.equal(name,'Draft dari Template Resmi');return folder;};
const token='12345678-1234-4321-8123-123456789012';
const jobPayload={...base,applicant:'Pemohon Uji',unit:'Bagian Umum'};
let copies=0,reservations=0,archives=0,allowSharing=false,shared=false;
let lineText, draftBody='Isi', archivedBody;
ctx.letterDraftRender_=(_,m)=>{lineText='Nomor : '+m.code;draftBody=m.body;};
const output={getId:()=> 'draft-id',getAs:()=>({setName(){return this;},getName:()=> 'draft.pdf',getBytes:()=>[1,2],body:draftBody}),
  setSharing(access,permission){assert.equal(access,'link');assert.equal(permission,'edit');if(!allowSharing)throw Error('temporary sharing error');shared=true;},
  getSharingAccess:()=>shared?'link':'private',getSharingPermission:()=>shared?'edit':'none'};
ctx.DriveApp.getFileById=id=>id==='draft-id'?output:{makeCopy:(_,folder)=>{assert.equal(folder.name,'private');copies++;return output;}};
ctx.DocumentApp={openById:id=>{assert.equal(id,'draft-id');return {saveAndClose(){},getBody:()=>({
  getParagraphs:()=>[{getText:()=>draftBody},{
    getText:()=>lineText,replaceText:(_,number)=>{lineText=lineText.replace('[BELUM BERNOMOR]',number);}
  }]
})};}};
let expectedToken=token, failUpload=false;
ctx.reserveRequest=p=>{assert.equal(p.requestToken,expectedToken);reservations++;return {number:501,requestId:'r1'};};
ctx.uploadDraft=p=>{
  assert.equal(p.reservedRequestId,'r1');
  assert.equal(p.requestToken,expectedToken);
  if(failUpload) throw Error('Upload tertunda');
  archives++;
  archivedBody=p.draft.body;
};
ctx.toUserSafeError_=e=>e.message;
ctx.console={error(){},log:console.log};
assert.throws(()=>ctx.createLetterDraft(jobPayload,token,true),/Nomor 501 telah terbit/);
assert.equal(shared,false);
allowSharing=true;
const outputResult=ctx.createLetterDraft(jobPayload,token,true);
assert.match(outputResult.code,/^B-501\//);
assert.equal(outputResult.url,'https://docs.google.com/document/d/draft-id/edit');
assert.equal(ctx.createLetterDraft(jobPayload,token,true).url,outputResult.url);
assert.deepEqual([copies,reservations,archives,shared],[1,1,1,true]);

// Numbering reuses a saved preview and archives the edited Docs content.
const previewToken='a2345678-1234-4321-8123-123456789012';
assert.throws(()=>ctx.numberLetterDraft(previewToken,'Pemohon Uji','Bagian Umum'),/Buka pratinjau/);
const preview=ctx.createLetterDraft({...base,target:multiAddress},previewToken,false);
assert.match(preview.code,/\[BELUM BERNOMOR\]/);
assert.deepEqual([copies,reservations,archives],[2,1,1]);
lineText='Baris Nomor telah dihapus';
assert.match(ctx.numberLetterDraft(previewToken,'Pemohon Uji','Bagian Umum').message,/Pulihkan baris Nomor/);
assert.equal(reservations,1);
lineText='Nomor : '+preview.code;
draftBody='Isi diedit di Google Docs';
expectedToken=previewToken;
failUpload=true;
assert.throws(()=>ctx.numberLetterDraft(previewToken,'Pemohon Uji','Bagian Umum'),/Nomor 501 telah terbit/);
failUpload=false;
const numbered=ctx.numberLetterDraft(previewToken,'Pemohon Uji','Bagian Umum');
assert.equal(numbered.url,preview.url);
assert.match(numbered.code,/^B-501\//);
assert.equal(lineText,'Nomor : '+numbered.code);
assert.equal(archivedBody,'Isi diedit di Google Docs');
assert.equal(ctx.numberLetterDraft(previewToken,'Pemohon Uji','Bagian Umum').url,preview.url);
assert.deepEqual([copies,reservations,archives],[2,3,2]);
console.log('PASS letter templates, multiline address, production guard, same-Docs preview and numbering, edit archival and retry.');
