const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ctx = vm.createContext({console});
for (const file of ['LetterDraftClassification.js','LetterDrafts.js']) {
  vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
}
const signer={id:'fitri-role',code:'',name:'Nama Contoh, S.E.',short:'Nama Contoh',title:'Ketua Tim',nip:'199001012020011001'};
const base={type:'SD',urgency:'B',date:'2026-11-09',signer:signer.id,subject:'Perihal',target:'Tujuan',body:'Isi',classification:'HM.01'};
const model=(data)=>ctx.letterDraftModel_({...base,...data},[signer],[{name:'Gedung Uji',recipient:'Rektor'}]);
assert.equal(model({}).code,'B-[BELUM BERNOMOR]/Un.07/01//HM.01/11/2026');
assert.equal(model({behalf:true}).code,'B-[BELUM BERNOMOR]/Un.07/01/R//HM.01/11/2026');
assert.throws(()=>model({date:'2026-02-30'}),/Tanggal tidak valid/);
assert.throws(()=>model({classification:'random'}),/klasifikasi/);
const event={start:'2026-11-09',end:'2026-11-10',time:'09.00',place:'Ruang uji',activity:'Kegiatan uji'};
assert.deepEqual(Array.from(model({type:'UNDANGAN',...event,agenda:'Rapat',recipients:['Seluruh Wakil Rektor','Wakil Rektor Bidang Akademik','Rektor','rektor']}).target),['Seluruh Wakil Rektor','Rektor']);
assert.equal(model({type:'ST_SPD',...event,people:[['Nama','','','Jabatan'],['Nama II','','','Jabatan II']]}).people.length,2);
assert.throws(()=>model({type:'ST_SPD',...event,people:[['Nama','123','','Jabatan']]}),/18 digit/);
assert.equal(model({type:'GEDUNG',...event,building:'Gedung Uji',participants:'20',contactName:'Uji',contactNumber:'0800'}).target[0],'Rektor');
assert.throws(()=>model({type:'GEDUNG',...event,building:'Gedung lain'}),/Pilih gedung/);
assert.equal(model({type:'KENDARAAN',...event,contactName:'Uji',contactNumber:'0800'}).vehicles,'');
assert.match(model({type:'SK',activity:'Kegiatan'}).code,/HK\.00\.5/);
assert.equal(model({type:'KHUSUS',recipients:['Rektor']}).target[0],'Rektor');
assert.throws(()=>model({type:'UNDANGAN',...event,start:'2026-11-11',agenda:'Rapat'}),/mendahului/);
const html=fs.readFileSync('LetterDraftsUI.html','utf8');
for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
assert.throws(()=>vm.runInContext("ScriptApp={getScriptId:()=> 'production'}; letterDraftGuard_()",ctx),/web app uji/);
console.log('PASS model seven types, pending number, invalid dates/classifications, empty codes, recipient deduplication, personnel, building routing, UI syntax, production guard.');
