'use strict';
// Isolated prototype. No Drive, Sheets, numbering or deployment side effects.
const FIXED = Object.freeze({UNDANGAN:'HM.01',ST_SPD:'KP.01.1',GEDUNG:'KS.01.1',KENDARAAN:'KS.01.5',SK:'HK.00.5'});
const TYPES = ['SD', ...Object.keys(FIXED), 'KHUSUS'];
const URGENCY = ['B','Sg','Pt','R','SR'];
function text(v) { return v == null ? '' : String(v).trim(); }
function dateParts(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error('INVALID_DATE');
  const [y,m,d]=value.split('-').map(Number);
  const date=new Date(Date.UTC(y,m-1,d));
  if(date.getUTCFullYear()!==y || date.getUTCMonth()!==m-1 || date.getUTCDate()!==d) throw Error('INVALID_DATE');
  return {year:String(y),month:String(m).padStart(2,'0'),date};
}
function officials(rows, allowedCodes) {
  const records=[];
  rows.forEach((r,i)=>{
    if(i<3 || !text(r[1])) return;
    const code=text(r[0]), nip=r[2], fullName=text(r[1]), title=text(r[3]);
    let shortName=text(r[4]);
    if(typeof nip!=='string' || !/^\d{18}$/.test(nip)) throw Error('NIP_MUST_BE_18_DIGIT_TEXT_ROW_'+(i+1));
    if(!title || !shortName) throw Error('INCOMPLETE_OFFICIAL_ROW_'+(i+1));
    if(code && !allowedCodes.includes(code)) throw Error('UNKNOWN_OFFICIAL_CODE_'+code);
    // Exact, user-confirmed correction only; never strip titles heuristically.
    if(code==='R2' && shortName==='Ali Musthofa' && fullName==='Dr. Ali Mustofa, M.Pd') shortName='Ali Mustofa';
    const id=nip+'|'+title;
    if(records.some(x=>x.id===id)) throw Error('DUPLICATE_OFFICIAL_ROLE');
    records.push({id,code,nip,fullName,shortName,title,sourceRow:i+1});
  });
  return records;
}
function compose(input, master, classifications) {
  if(!TYPES.includes(input.type)) throw Error('INVALID_TYPE');
  if(!URGENCY.includes(input.urgency)) throw Error('INVALID_URGENCY');
  if(!['direct','an_rektor'].includes(input.mode)) throw Error('INVALID_SIGNING_MODE');
  const signer=master.find(x=>x.id===input.signerId);
  if(!signer) throw Error('SIGNER_NOT_FOUND');
  if(input.mode==='an_rektor' && signer.code==='R') throw Error('RECTOR_CANNOT_SIGN_FOR_SELF');
  const classification=FIXED[input.type] || input.classification;
  if(!FIXED[input.type] && !classifications.includes(classification)) throw Error('INVALID_CLASSIFICATION');
  const {month,year}=dateParts(input.letterDate);
  const number=input.number==null ? '[BELUM BERNOMOR]' : text(input.number);
  if(!number || /[\/\r\n]/.test(number)) throw Error('INVALID_NUMBER');
  const segments=['Un.07','01'];
  if(input.mode==='an_rektor') segments.push('R');
  segments.push(signer.code,classification,month,year);
  return {code:input.urgency+'-'+number+'/'+segments.join('/'),classification,
    from:input.type==='SD'?signer.fullName:signer.shortName,
    name:input.type==='SD'?signer.fullName:signer.shortName,
    nip:input.type==='SD'?signer.nip:'',
    title:(input.mode==='an_rektor'?'a.n. Rektor,\n':'')+signer.title};
}
function orderRecipients(selected, registry, groups, manualOrder) {
  const covered=new Set(),result=[];
  // Explicit group choices take precedence over individual members.
  selected.filter(id=>groups[id]).forEach(id=>{
    const g=groups[id];
    if(result.some(x=>x.id===id)) return;
    g.members.forEach(m=>covered.add(m));
    result.push({id,label:g.label,rank:g.rank,order:g.order||0});
  });
  selected.filter(id=>!groups[id]).forEach(id=>{
    if(covered.has(id)||result.some(x=>x.id===id)) return;
    const r=registry[id];if(!r) throw Error('UNKNOWN_RECIPIENT');
    result.push({id,...r});
  });
  result.sort((a,b)=>(a.rank??999)-(b.rank??999)||(a.order??0)-(b.order??0));
  if(manualOrder){
    if(new Set(manualOrder).size!==result.length || manualOrder.length!==result.length || result.some(r=>!manualOrder.includes(r.id))) throw Error('INVALID_MANUAL_ORDER');
    result.sort((a,b)=>manualOrder.indexOf(a.id)-manualOrder.indexOf(b.id));
  }
  return result;
}
function mergeText(source, fields){
  const missing=[];
  const out=source.replace(/\{\{([^}]+)\}\}/g,(_,k)=>{
    if(!Object.prototype.hasOwnProperty.call(fields,k)){missing.push(k);return '';}
    return String(fields[k]);
  });
  if(missing.length) throw Error('UNRESOLVED_FIELDS:'+missing.join(','));
  return out;
}
module.exports={FIXED,officials,compose,orderRecipients,mergeText,dateParts};
