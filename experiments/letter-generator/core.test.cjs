'use strict';
const a=require('node:assert/strict');
const {officials,compose,orderRecipients,mergeText,dateParts,FIXED}=require('./core.cjs');
let count=0;const test=(name,fn)=>{fn();count++;console.log('PASS',name);};
const rows=[[],['Kode','Nama','NIP','Jabatan','Nama tanpa gelar'],[],
['BU','Dr. Nama Uji','199001012020011001','Plt. Kepala Biro','Nama Uji'],
['BU1','Dr. Nama Uji','199001012020011001','Kepala Bagian','Nama Uji'],
['','Nama Kedua','199001012020011002','Ketua Tim','Nama Kedua'],
['R','Prof. Nama Ketiga','199001012020011003','Rektor','Nama Ketiga'],
['R2','Dr. Ali Mustofa, M.Pd','199001012020011004','Wakil Rektor','Ali Musthofa']];
const master=officials(rows,['BU','BU1','R','R2']);
const base={type:'SD',urgency:'B',mode:'direct',letterDate:'2026-11-06',number:'UJI-001',signerId:master[0].id,classification:'HM.01'};
test('same person retains separate official roles',()=>a.notEqual(master[0].id,master[1].id));
test('confirmed spelling override',()=>a.equal(master[4].shortName,'Ali Mustofa'));
test('direct SD name and NIP',()=>{const r=compose(base,master,['HM.01']);a.equal(r.code,'B-UJI-001/Un.07/01/BU/HM.01/11/2026');a.equal(r.nip,'199001012020011001');a.equal(r.name,'Dr. Nama Uji');});
test('all five fixed classifications resist payload override',()=>{for(const type of Object.keys(FIXED)){const r=compose({...base,type,classification:'INVALID'},master,[]);a.equal(r.classification,FIXED[type]);a.equal(r.nip,'');a.equal(r.name,'Nama Uji');}});
test('uncoded direct signer preserves empty segment',()=>a.equal(compose({...base,signerId:master[2].id},master,['HM.01']).code,'B-UJI-001/Un.07/01//HM.01/11/2026'));
test('uncoded a.n. preserves empty segment',()=>a.equal(compose({...base,mode:'an_rektor',signerId:master[2].id},master,['HM.01']).code,'B-UJI-001/Un.07/01/R//HM.01/11/2026'));
test('a.n. coded signer',()=>a.match(compose({...base,mode:'an_rektor'},master,['HM.01']).code,/\/R\/BU\//));
test('rector self delegation rejected',()=>a.throws(()=>compose({...base,mode:'an_rektor',signerId:master[3].id},master,['HM.01']),/SELF/));
test('reject numeric NIP to prevent precision loss',()=>{const r=structuredClone(rows);r[3][2]=199001012020011000;a.throws(()=>officials(r,['BU']),/TEXT/);});
test('reject unknown signer',()=>a.throws(()=>compose({...base,signerId:'fake'},master,['HM.01']),/NOT_FOUND/));
test('reject unknown free classification',()=>a.throws(()=>compose({...base,classification:'FAKE'},master,['HM.01']),/CLASSIFICATION/));
test('reject impossible date',()=>a.throws(()=>dateParts('2026-02-30'),/DATE/));
test('accept leap date and derive month/year',()=>a.equal(compose({...base,letterDate:'2028-02-29'},master,['HM.01']).code.slice(-7),'02/2028'));
test('draft no number',()=>a.match(compose({...base,number:null},master,['HM.01']).code,/BELUM BERNOMOR/));
const registry={senat:{label:'Senat',rank:1},rektor:{label:'Rektor',rank:2},wr1:{label:'WR I',rank:3},wr2:{label:'WR II',rank:3},direktur:{label:'Direktur',rank:5},dekan:{label:'Dekan',rank:6},manual:{label:'Eksternal',rank:999}};
const groups={warek:{label:'Seluruh Wakil Rektor',rank:3,members:['wr1','wr2']}};
test('hierarchy and group deduplication',()=>a.deepEqual(orderRecipients(['dekan','wr1','warek','rektor','senat','direktur'],registry,groups).map(r=>r.id),['senat','rektor','warek','direktur','dekan']));
test('manual reorder survives sorting',()=>a.deepEqual(orderRecipients(['rektor','manual'],registry,groups,['manual','rektor']).map(r=>r.id),['manual','rektor']));
test('unresolved placeholders fail',()=>a.throws(()=>mergeText('{{A}} {{B}}',{A:'one'}),/B/));
test('replacement values are not interpreted as code',()=>a.equal(mergeText('{{A}}',{A:'$& <script>'}),'$& <script>'));
console.log(count+' tests passed. No production calls.');
