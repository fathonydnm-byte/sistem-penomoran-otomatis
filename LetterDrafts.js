var LETTER_DRAFT_TYPES = {
  SD: ['Surat Dinas', '', '', '1MSwelHCObT9y2kXDw9ZpnqKJIQaY5o4b2xCWEUDqL_8'],
  UNDANGAN: ['Nota Dinas Undangan', 'HM.01', 'Undangan', '1DCuwoYfatgg3Ldpf1grpijCt-_JxMVYorTT5Ei3VYBc'],
  ST_SPD: ['Nota Dinas ST/SPD', 'KP.01.1', 'Permohonan Penerbitan ST dan SPD', '1M98l4arqCH0shNL_DEyrASMIGYkrRBvKAJWR7qk563s'],
  GEDUNG: ['Nota Dinas Gedung', 'KS.01.1', 'Permohonan Peminjaman Gedung', '1H4EJ14xEhWhHqtjkWoC__arSu19x9xhRiooLjG7jolM'],
  KENDARAAN: ['Nota Dinas Kendaraan', 'KS.01.5', 'Permohonan Peminjaman Kendaraan Dinas', '1O7vkGViH-R_m_gG_yYSn7BnFf8r2m5ECuIi6yB9YyJ8'],
  SK: ['Nota Dinas SK', 'HK.00.5', 'Permohonan Penerbitan SK', '1nwQudsjDcc_TCi_AAVB775zAV2UshTcMagbZwxzG2H0'],
  KHUSUS: ['Nota Dinas Khusus', '', '', '13DvbBaDHaNX5NUXb6OUcz6p6xG34uC1FkrHusNYyQiI']
};
var LETTER_DRAFT_URGENCY = { B:'Biasa', Sg:'Segera', Pt:'Penting', R:'Rahasia', SR:'Sangat Rahasia' };
var LETTER_DRAFT_PENDING = '[BELUM BERNOMOR]';
var LETTER_DRAFT_RECIPIENT_HIERARCHY = [
  /^(?:Ketua|Sekretaris).*\bSenat\b/i, /^Rektor\b/i, /^Wakil Rektor\b/i, /^Kepala Biro\b/i,
  /^Direktur Pascasarjana\b/i, /^Dekan\b/i, /^Wakil Direktur Pascasarjana\b/i, /^Wakil Dekan\b/i,
  /^Ketua (?:Lembaga|LPM|LP2M)\b/i, /^Kepala (?:Satuan Pengawas Internal|SPI)\b/i,
  /^Wakil Koordinator Kopertais\b/i, /^Kepala (?:UPT|Pusat|Perpustakaan)\b/i,
  /^(?:Ketua|Sekretaris) Program Studi\b/i, /^(?:Kepala Bagian|Ketua Tim)\b/i,
  /^Kepala Sub[. ]*\s*Bagian\b/i, /^Dosen\b/i, /^Tenaga Kependidikan\b/i
];
function letterDraftGuard_() {
  var scriptId=ScriptApp.getScriptId();
  if (scriptId==='1voCWP8UrNRyXNgCZPUaFkgmbZEKOzOZ1TodxLLuMb_kWT9BtxB5HiFlz' &&
      typeof bindChunkStaging_==='function') {
    bindChunkStaging_();
    return {staging:true,masterId:'1UR8puYkKdOKyMEqBbXYgBei1hNCvPSoMjGFkxTSgNhM'};
  }
  var props=PropertiesService.getScriptProperties();
  if (scriptId!=='1a105dbVLfTVRwogvyvA4TIk5QmZnBLmUVnk1SoUxCBU_KEHmg28tv29_' ||
      props.getProperty('LETTER_DRAFT_ENABLED')==='0') {
    throw Error('Generator surat sedang dipersiapkan.');
  }
  return {staging:false,masterId:'1UR8puYkKdOKyMEqBbXYgBei1hNCvPSoMjGFkxTSgNhM'};
}
function letterDraftMaster_(mode) {
  if(!mode.masterBook) mode.masterBook=SpreadsheetApp.openById(mode.masterId);
  return mode.masterBook;
}
// Read only the four approved personnel fields; never return NPWP or other HR columns.
function searchLetterDraftEmployees(query) {
  var mode=letterDraftGuard_();
  var q=letterDraftText_(query,100,'Pencarian nama').toLowerCase().replace(/\s+/g,' ').trim();
  if(q.length<2) return {items:[],more:false};
  var sheet=letterDraftMaster_(mode).getSheetByName('Master_Pegawai');
  if(!sheet) throw Error('Master pegawai belum tersedia. Anda tetap dapat mengisi manual.');
  var last=sheet.getLastRow();
  if(last<2) return {items:[],more:false};
  var identity=sheet.getRange(1,1,last,2).getDisplayValues();
  var roles=sheet.getRange(1,4,last,2).getDisplayValues();
  if(identity[0][0].trim()!=='NIP/NIPPPK'||identity[0][1].trim()!=='Nama'||
     roles[0][0].trim()!=='Pangkat/Gol'||roles[0][1].trim()!=='Jabatan') {
    throw Error('Struktur Master_Pegawai berubah. Anda tetap dapat mengisi manual.');
  }
  var words=q.split(' '), items=[];
  for(var i=1;i<identity.length;i++) {
    var name=String(identity[i][1]||'').trim(), nip=String(identity[i][0]||'').trim();
    var searchable=(name+' '+nip).toLowerCase();
    if(!name||!words.every(function(w){return searchable.indexOf(w)!==-1;})) continue;
    items.push({name:name,nip:nip,rank:String(roles[i][0]||'').trim(),title:String(roles[i][1]||'').trim()});
    if(items.length===21) break;
  }
  return {items:items.slice(0,20),more:items.length>20};
}
// Match the approved ST/SPD sample (widths in points, total 465 pt).
function letterDraftPeopleTable_(table) {
  [32.25,118.5,128.25,59.25,126.75].forEach(function(width,i){table.setColumnWidth(i,width);});
  table.setBorderWidth(0.5).setBorderColor('#000000');
  for(var r=0;r<table.getNumRows();r++) {
    var row=table.getRow(r);
    for(var c=0;c<row.getNumCells();c++) {
      var cell=row.getCell(c);
      cell.setPaddingTop(5).setPaddingBottom(5).setPaddingLeft(5).setPaddingRight(5)
        .setVerticalAlignment(DocumentApp.VerticalAlignment.TOP);
      cell.editAsText().setFontFamily('Arial').setFontSize(11).setBold(r===0);
      for(var n=0;n<cell.getNumChildren();n++) {
        var paragraph=cell.getChild(n).asParagraph();
        paragraph.setAlignment(r===0?DocumentApp.HorizontalAlignment.CENTER:DocumentApp.HorizontalAlignment.LEFT)
          .setIndentStart(0).setIndentEnd(0).setIndentFirstLine(0).setSpacingBefore(0).setSpacingAfter(0).setLineSpacing(1.15);
      }
    }
  }
}
function letterDraftOfficials_(mode) {
  var sheet=letterDraftMaster_(mode).getSheetByName('MASTER PEJABAT');
  if (!sheet || sheet.getLastRow()<4) throw Error('Master pejabat belum tersedia. Hubungi Bagian Umum.');
  var seen=new Set();
  var officials=sheet.getRange(4,1,sheet.getLastRow()-3,5).getDisplayValues().map(function(row) {
    return row.map(function(value) {return value.trim();});
  }).filter(function(r) {return r[3];}).map(function(r) {
    var id=Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify([r[1],r[3],r[0]])));
    if(seen.has(id)) throw Error('Master pejabat berisi baris ganda. Hubungi Bagian Umum.');
    seen.add(id);
    return {id:id,code:r[0],name:r[1],nip:r[2],title:r[3],short:r[0]==='R2'&&r[4]==='Ali Musthofa'?'Ali Mustofa':r[4]};
  });
  if (!officials.some(function(o) {return o.name && o.short;})) {
    throw Error('Master pejabat belum tersedia. Hubungi Bagian Umum.');
  }
  return officials;
}
function letterDraftBuildings_(mode) {
  var sheet=letterDraftMaster_(mode).getSheetByName('MASTER GEDUNG');
  if (!sheet || sheet.getLastRow()<2) {
    return mode.staging?[{name:'Gedung Uji A (data buatan)',recipient:'R'}]:[];
  }
  return sheet.getRange(2,1,sheet.getLastRow()-1,2).getDisplayValues().map(function(row) {
    return {name:row[0].trim(),recipient:row[1].trim()};
  }).filter(function(row) {return row.name && row.recipient;});
}
function letterDraftRecipientOptions_(officials) {
  var seen=new Set();
  return officials.map(function(o) {
    var role=o.title.replace(/^(?:Plt|Plh|Pj)\.?\s+/i,'');
    var rank=LETTER_DRAFT_RECIPIENT_HIERARCHY.findIndex(function(rule) {return rule.test(role);});
    return {id:o.id,title:o.title,rank:rank<0?LETTER_DRAFT_RECIPIENT_HIERARCHY.length:rank};
  }).sort(function(a,b) {return a.rank-b.rank;}).filter(function(o) {
    var key=o.title.toLowerCase();
    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(function(o) {return {id:o.id,title:o.title};});
}
function letterDraftRoutingTitle_(officials,reference) {
  var key=reference.toLowerCase();
  var official=officials.find(function(o) {return o.code.toLowerCase()===key;}) ||
    officials.find(function(o) {return o.title.toLowerCase()===key;});
  if(!official) throw Error('Tujuan surat ('+reference+') belum ditemukan di MASTER PEJABAT. Hubungi Bagian Umum.');
  return official.title;
}
function getLetterDraftOptions() {
  var mode=letterDraftGuard_(), buildings=letterDraftBuildings_(mode);
  var officials=letterDraftOfficials_(mode);
  return {
    staging:mode.staging,
    officials:officials.filter(function(o) {return o.name && o.short;})
      .map(function(o) {return {id:o.id,label:o.short+' — '+o.title,rector:o.code==='R'};}),
    types:Object.keys(LETTER_DRAFT_TYPES).filter(function(k) {return k!=='GEDUNG'||buildings.length;})
      .map(function(k) {return {id:k,label:LETTER_DRAFT_TYPES[k][0],code:LETTER_DRAFT_TYPES[k][1]};}),
    urgency:LETTER_DRAFT_URGENCY,classifications:LETTER_DRAFT_CLASSIFICATIONS,recipients:letterDraftRecipientOptions_(officials),
    buildings:buildings.map(function(b) {return b.name;}),units:UNIT_OPTIONS,today:reservationDateKey_(new Date())
  };
}
function letterDraftText_(value,max,label) {
  var result = typeof value==='string' ? value.trim() : '';
  if (result.length>max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(result)) throw Error(label+' tidak valid atau terlalu panjang.');
  return result;
}
function letterDraftDate_(value,withDay) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value||'')) throw Error('Tanggal belum diisi dengan benar.');
  var date=new Date(value+'T12:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==value) throw Error('Tanggal tidak valid.');
  var months=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  var days=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  return (withDay?days[date.getUTCDay()]+', ':'')+date.getUTCDate()+' '+months[date.getUTCMonth()]+' '+date.getUTCFullYear();
}
function letterDraftModel_(p,officials,buildings) {
  if (!p || typeof p !== 'object') throw Error('Data surat tidak ditemukan.');
  var kind=LETTER_DRAFT_TYPES[p.type];
  if (!Object.prototype.hasOwnProperty.call(LETTER_DRAFT_TYPES,p.type) ||
      !Object.prototype.hasOwnProperty.call(LETTER_DRAFT_URGENCY,p.urgency)) throw Error('Jenis atau sifat surat tidak valid.');
  var signer=officials.find(function(o) {return o.id===p.signer;});
  if (!signer || !signer.name || !signer.short || (p.behalf && signer.code==='R')) throw Error('Penandatangan tidak valid.');
  var classification=kind[1] || p.classification;
  if (!kind[1] && !LETTER_DRAFT_CLASSIFICATIONS.some(function(c) {return c[0]===classification;})) throw Error('Pilih kode klasifikasi.');
  var date=letterDraftDate_(p.date,false);
  var code=p.urgency+'-'+LETTER_DRAFT_PENDING+'/Un.07/01/'+(p.behalf?'R/':'')+signer.code+'/'+classification+'/'+p.date.slice(5,7)+'/'+p.date.slice(0,4);
  function field(k,label,max,required) {
    var value=letterDraftText_(p[k],max,label);
    if (required && !value) throw Error(label+' wajib diisi.');
    return value;
  }
  var t=p.type, free=t==='SD'||t==='KHUSUS';
  var subject=free?field('subject','Perihal',300,true):kind[2], target=[], body='';
  var eventDate='',time='',place='',participants='',vehicles='',contact='',activity='',people=[];
  if (['UNDANGAN','ST_SPD','GEDUNG','KENDARAAN'].indexOf(t)>=0) {
    eventDate=letterDraftDate_(p.start,true);
    if (p.end && p.end!==p.start) {
      if (p.end<p.start) throw Error('Tanggal selesai mendahului tanggal mulai.');
      eventDate+=' s.d. '+letterDraftDate_(p.end,true);
    }
    if (t!=='ST_SPD') time=field('time','Waktu kegiatan',80,true);
    if (t!=='GEDUNG') place=field('place','Tempat kegiatan',250,true);
  }
  if (free) body=field('body','Isi surat',5000,true);
  if (t==='SD') target=[field('target','Tujuan surat',300,true).replace(/\r\n?/g,'\n')];
  if (t==='KHUSUS'||t==='UNDANGAN') {
    if (!Array.isArray(p.recipients)||p.recipients.length>30) throw Error('Daftar penerima tidak valid.');
    target=p.recipients.map(function(x) {
      if(typeof x==='string') return letterDraftText_(x,150,'Penerima');
      var official=x && officials.find(function(o) {return o.id===x.id;});
      if(!official) throw Error('Jabatan penerima telah berubah di MASTER PEJABAT. Muat ulang SIDDIQ dan pilih kembali.');
      return official.title;
    }).filter(Boolean)
      .filter(function(x,i,a) {return a.findIndex(function(s) {return s.toLowerCase()===x.toLowerCase();})===i;});
    if (target.some(function(x) {return /^Seluruh Wakil Rektor$/i.test(x);})) {
      target=target.filter(function(x) {return !/^(?:(?:Plt|Plh|Pj)\.?\s+)?Wakil Rektor\b/i.test(x);});
    }
    if (!target.length) throw Error('Tambahkan penerima.');
  }
  if (t==='GEDUNG') {
    var building=buildings.find(function(b) {return b.name===p.building;});
    if (!building) throw Error('Pilih gedung yang memiliki tujuan surat.');
    place=building.name;
    target=[letterDraftRoutingTitle_(officials,building.recipient)];
    subject+=' '+place.replace(/^Gedung /i,'');
  }
  if (t==='ST_SPD'||t==='SK') target=[letterDraftRoutingTitle_(officials,'R')];
  if (t==='KENDARAAN') target=[letterDraftRoutingTitle_(officials,'BU1')+' Kantor Pusat UIN Sunan Ampel Surabaya'];
  if (t==='GEDUNG'||t==='KENDARAAN') {
    participants=field('participants','Jumlah peserta',5,t==='GEDUNG');
    if (t==='KENDARAAN') vehicles=field('vehicles','Jumlah kendaraan',5,false);
    [participants,vehicles].forEach(function(n) {if(n&&!/^[1-9]\d*$/.test(n)) throw Error('Jumlah harus berupa bilangan positif.');});
    contact=field('contactName','Nama penanggung jawab',100,true)+' — '+field('contactNumber','Kontak penanggung jawab',50,true);
  }
  if (t==='ST_SPD'||t==='GEDUNG'||t==='KENDARAAN'||t==='SK') activity=field('activity','Nama kegiatan',350,true);
  if (t==='ST_SPD') {
    if (!Array.isArray(p.people)||!p.people.length||p.people.length>55) throw Error('Tambahkan 1–55 personel.');
    people=p.people.map(function(row) {
      if (!Array.isArray(row)||row.length!==4) throw Error('Data personel tidak valid.');
      var person=row.map(function(x) {return letterDraftText_(x,150,'Data personel');});
      if (!person[0] || !person[3]) throw Error('Nama dan jabatan personel wajib diisi.');
      return person;
    });
  }
  return {type:t,kind:kind,signer:signer,behalf:!!p.behalf,code:code,date:date,letterDate:p.date,subject:subject,target:target,
    urgency:LETTER_DRAFT_URGENCY[p.urgency],body:body,eventDate:eventDate,time:time,place:place,participants:participants,vehicles:vehicles,contact:contact,
    activity:activity,people:people,agenda:t==='UNDANGAN'?field('agenda','Acara',250,true):'',
    basis:t==='UNDANGAN'?field('basis','Dasar undangan',350,false):'', theme:t==='UNDANGAN'?field('theme','Tema',250,false):'',
    note:t==='UNDANGAN'?field('note','Catatan',500,false):''};
}
function previewLetterDraft(p) {
  var mode=letterDraftGuard_();
  var m=letterDraftModel_(p,letterDraftOfficials_(mode),p && p.type==='GEDUNG'?letterDraftBuildings_(mode):[]);
  return {code:m.code,date:m.date,subject:m.subject,to:m.target,signer:m.signer.title,from:m.type==='SD'?m.signer.name:m.signer.short};
}
function letterDraftRender_(doc,m) {
  var body=doc.getBody();
  var children=Array.from({length:body.getNumChildren()},function(_,i) {return body.getChild(i);});
  function para(i) {return children[i].asParagraph();}
  function write(p,value,afterColon) {
    var t=p.editAsText(), old=t.getText(), start=0;
    if (afterColon) {
      var label=old.match(/^[^:]+:\s*/);
      if (!label) throw Error('Label template tidak ditemukan.');
      start=label[0].length;
    }
    var attrs=old.length>start?t.getAttributes(start):null;
    if (old.length>start) t.deleteText(start,old.length-1);
    if (value) {
      t.insertText(start,value);
      if (attrs) t.setAttributes(start,start+value.length-1,attrs);
    }
  }
  function set(i,value,afterColon) {write(para(i),value,afterColon);}
  function remove(first,last) {for(var i=last;i>=first;i--) body.removeChild(children[i]);}
  function recipients(first,last) {
    var many=m.target.length>1;
    set(first,(many?'1. ':'')+m.target[0],true);
    var base=para(last).copy();
    remove(first+1,last);
    var pos=body.getChildIndex(children[first])+1;
    m.target.slice(1).forEach(function(label,index) {
      body.insertParagraph(pos+index,base.copy()).setText((index+2)+'. '+label);
    });
  }
  var type=m.type, name=m.signer.short, title=m.signer.title;
  var signing=(m.behalf?'a.n. Rektor,\n':'')+title;
  if (!para(1).getText().match(/^Nomor\s*:\s*B-UJI-00[1-7]\//)) throw Error('Versi template sudah berubah. Hubungi admin.');
  set(1,m.code,true);
  if (type==='SD') {
    set(0,m.date);
    set(3,m.subject,true);
    var address=m.target[0].split('\n');
    set(7,address[0]);
    if(address.length===1) remove(8,8);
    else {
      var addressStyle=para(8).copy(), addressIndex=body.getChildIndex(children[8]);
      set(8,address[1]);
      address.slice(2).forEach(function(line,i) {
        write(body.insertParagraph(addressIndex+i+1,addressStyle.copy()),line);
      });
    }
    set(12,m.body);
    remove(13,16);
    set(22,signing+',');
    remove(23,23);
    set(27,m.signer.name);
    set(28,'NIP '+m.signer.nip);
    return;
  }
  var layout={UNDANGAN:[9,23,28],ST_SPD:[4,18,23],GEDUNG:[4,16,21],KENDARAAN:[5,19,24],SK:[4,16,22],KHUSUS:[5,20,24]}[type];
  set(layout[0],title,true);
  set(layout[0]+1,m.urgency,true);
  set(layout[0]+2,m.subject,true);
  set(layout[0]+3,m.date,true);
  set(layout[1],signing);
  set(layout[2],name);
  if (type==='SK') {
    set(3,m.target[0],true);
    remove(17,17);
    set(10,'Disampaikan dengan hormat, dalam rangka '+m.activity+', maka kami mengajukan permohonan kepada Bapak '+m.target[0]+' untuk berkenan menerbitkan SK pada kegiatan tersebut.');
  }
  if (type==='KHUSUS') {
    recipients(3,4);
    set(12,m.body);
    remove(13,16);
  }
  if (type==='UNDANGAN') {
    recipients(3,8);
    set(15,(m.basis?'Berdasarkan '+m.basis+', bersama ini':'Dengan hormat,')+' kami mengharapkan kehadiran Bapak/Ibu pada:');
    set(16,m.eventDate,true);
    set(17,m.time,true);
    set(18,['\tTempat\t: '+m.place,'\tAcara\t\t: '+m.agenda].concat(m.theme?['\tTema\t\t: '+m.theme]:[],m.note?['\tCatatan\t: '+m.note]:[]).join('\n'));
  }
  if (type==='ST_SPD') {
    set(3,m.target[0],true);
    set(10,'Dalam rangka '+m.activity+', mohon perkenaan Bapak '+m.target[0]+' untuk memberikan izin dan menugaskan nama yang tersebut di bawah ini:');
    var existing=children[11].asTable();
    var pos=body.getChildIndex(existing);
    var table=body.insertTable(pos,[['No.','Nama','NIP/NIPPPK','Pangkat/Gol.','Jabatan']].concat(m.people.map(function(r,i){return [String(i+1)].concat(r);})));
    letterDraftPeopleTable_(table);
    existing.removeFromParent();
    set(12,'Hari dan tanggal penugasan '+m.eventDate+' di '+m.place+'.');
  }
  if(type==='GEDUNG'||type==='KENDARAAN') {
    set(3,type==='GEDUNG'?m.target[0]:m.target[0].replace(/ UIN Sunan Ampel Surabaya$/,''),true);
    var resource=type==='GEDUNG'?m.place:'kendaraan dinas';
    var lines=['Disampaikan dengan hormat, dalam rangka '+m.activity+', bersama ini kami bermaksud mengajukan permohonan peminjaman '+resource+' pada:',
      '', 'Hari/Tanggal\t\t: '+m.eventDate,'Pukul\t\t\t: '+m.time.replace(/\s*WIB$/i,'')+' WIB','Tempat\t\t: '+m.place];
    if(m.vehicles) lines.push('Jumlah Kendaraan\t: '+m.vehicles+' unit');
    if(m.participants) lines.push('Jumlah Peserta\t: '+m.participants+' orang');
    lines.push('Penanggung Jawab\t: '+m.contact);
    set(type==='GEDUNG'?10:11,lines.join('\n'));
    if(type==='KENDARAAN') remove(12,13);
  }
}
function letterDraftLock_(fn) {
  var lock=LockService.getScriptLock();
  try {lock.waitLock(30000);} catch(e) {throw Error('Sistem sedang sibuk. Pilih Lanjutkan proses beberapa saat lagi.');}
  try {return fn();} finally {lock.releaseLock();}
}
function letterDraftPayloadKey_(payload, withNumber) {
  var fields=Object.keys(payload||{}).sort().map(function(key) {return [key,payload[key]];});
  return JSON.stringify([fields,!!withNumber]);
}
function letterDraftRequest_(request,applicant,unit,token,date) {
  var result=Object.assign({},request,{
    applicantName:cleanText_(applicant,150),unit:unit,token:token,requestToken:token
  });
  [result.subject,result.from,result.to,result.applicantName].forEach(function(value) {
    if (/^\s*=/.test(value||'')) throw Error('Isian register tidak boleh dimulai dengan tanda sama dengan.');
  });
  validatePublicFields_(result);
  if(date>reservationDateKey_(new Date())) throw Error('Tanggal surat mendatang belum dapat diajukan.');
  return result;
}
function letterDraftNumberLine_(doc,code) {
  var lines=doc.getBody().getParagraphs().filter(function(p) {
    var text=p.getText(), match=/^Nomor\s*:\s*(.*)$/i.exec(text);
    return match && match[1].trim()===code;
  });
  return lines.length===1?lines[0]:null;
}
function letterDraftNumber_(job,file,request,date,token,save) {
  var doc=DocumentApp.openById(job.docId);
  var code=job.code.replace(LETTER_DRAFT_PENDING,String(job.number));
  if(!letterDraftNumberLine_(doc,job.code) && !(job.number && letterDraftNumberLine_(doc,code))) {
    throw Error('Pulihkan baris Nomor pada Google Docs sebelum melanjutkan.');
  }
  doc.saveAndClose();
  if(!job.archived) {
    var pdf=file.getAs(MimeType.PDF).setName('Draft Generator Surat.pdf');
    var today=reservationDateKey_(new Date());
    var reservation=job.reservation || reserveRequest(Object.assign({},request,{
      letterDate:date===today?'':date,draftName:pdf.getName(),draftSize:pdf.getBytes().length
    }));
    job.number=reservation.number;
    job.reservation={number:reservation.number,requestId:reservation.requestId,uploadComplete:!!reservation.uploadComplete};
    save();
    if(!reservation.uploadComplete) uploadDraft({reservedRequestId:reservation.requestId,requestToken:token,draft:pdf});
    job.archived=true;
    save();
  }
  code=job.code.replace(LETTER_DRAFT_PENDING,String(job.number));
  doc=DocumentApp.openById(job.docId);
  var line=letterDraftNumberLine_(doc,job.code);
  if(line) {
    line.replaceText('\\[BELUM BERNOMOR\\]',String(job.number));
  }
  if(!letterDraftNumberLine_(doc,code)) throw Error('Pulihkan baris Nomor pada Google Docs sebelum melanjutkan.');
  doc.saveAndClose();
  return code;
}
function createLetterDraft(p, token, withNumber) {
  var mode=letterDraftGuard_();
  var docsAuth=ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL,['https://www.googleapis.com/auth/documents']);
  if (docsAuth.getAuthorizationStatus()===ScriptApp.AuthorizationStatus.REQUIRED) {
    if (mode.staging) return {authorizationUrl:docsAuth.getAuthorizationUrl()};
    return {invalid:true,message:'Izin Google Docs belum aktif. Hubungi Bagian Umum.'};
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token||'')) throw Error('Identitas proses tidak valid.');
  var store=letterDraftJobStore_(token);
  var digest=Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,letterDraftPayloadKey_(p,withNumber)));
  var job=letterDraftLock_(function() {
    var j=store.get();
    if(j.hash && j.hash!==digest) throw Error('Data berubah. Mulai proses baru.');
    if(j.done) return j;
    if(j.until>Date.now()) throw Error('Surat sedang diproses. Coba lanjutkan beberapa saat lagi.');
    j.hash=digest;
    j.attempt=Number(j.attempt||0)+1;
    j.until=Date.now()+420000;
    store.set(j);
    return j;
  });
  if(job.done) return job.result;
  function save(){store.set(job);}
  var readyToWrite=false;
  try {
    if(!job.docId) {
      var m=letterDraftModel_(p,letterDraftOfficials_(mode),p && p.type==='GEDUNG'?letterDraftBuildings_(mode):[]);
      if(m.type==='SD' && !/^\d{18}$/.test(m.signer.nip)) throw Error('NIP penandatangan belum valid. Hubungi Bagian Umum.');
      var request={documentType:m.type==='SD'?'Surat Dinas':'Nota Dinas',subject:m.subject,
        from:m.type==='SD'?m.signer.name:m.signer.short,to:m.target.join(', ')};
      job.request=withNumber?letterDraftRequest_(request,p.applicant,p.unit,token,m.letterDate):request;
      if(!withNumber) job.previewDate=m.letterDate;
      readyToWrite=true;
      var folder=finalPrivateChild_(finalRoot_(),mode.staging?'Draft Generator Surat Uji':'Draft dari Template Resmi');
      var fileName=(mode.staging?'UJI — ':'Draft — ')+m.subject+' — '+token;
      var marker='SIDDIQ_RENDERED:'+token+':'+digest, file=null;
      // A lost makeCopy/checkpoint response must not leave two delivered drafts.
      // Only this token's undisclosed, private copies can be recovered or replaced.
      if(job.attempt>1) {
        var candidates=folder.getFilesByName(fileName);
        while(candidates.hasNext()) {
          var candidate=candidates.next();
          if(!file && candidate.getDescription()===marker) file=candidate;
          else candidate.setTrashed(true);
        }
      }
      if(!file) {
        file=DriveApp.getFileById(m.kind[3]).makeCopy(fileName,folder);
        try {
          var doc=DocumentApp.openById(file.getId());
          letterDraftRender_(doc,m);
          doc.saveAndClose();
          file.setDescription(marker);
        } catch(e) {
          file.setTrashed(true);
          throw e;
        }
      }
      job.docId=file.getId();
      job.code=m.code;
      save();
    }
    readyToWrite=true;
    var outputFile=DriveApp.getFileById(job.docId);
    var code=withNumber?letterDraftNumber_(job,outputFile,job.request,p.date,token,save):job.code;
    if(!mode.staging) letterDraftShare_(outputFile);
    job.result={url:'https://docs.google.com/document/d/'+job.docId+'/edit',code:code};
    job.done=true;
    return job.result;
  } catch(e) {
    console.error('Generator surat: '+e.message);
    if(job.number) throw Error('Nomor '+job.number+' telah terbit. Gunakan Lanjutkan proses untuk menyelesaikan dokumen.');
    if (!readyToWrite && !job.docId) return {invalid:true,message:toUserSafeError_(e)};
    if (/^Nomor cadangan tidak tersedia/.test(e.message)) {
      return {noSlot:true,message:e.message};
    }
    throw Error(toUserSafeError_(e));
  } finally {
    job.until=0;
    save();
  }
}
function numberLetterDraft(token,applicant,unit) {
  letterDraftGuard_();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token||'')) throw Error('Identitas proses tidak valid.');
  var store=letterDraftJobStore_(token);
  var job=letterDraftLock_(function() {
    var j=store.get();
    if(!j.done || !j.previewDate) throw Error('Buka pratinjau Google Docs terlebih dahulu.');
    if(j.numberedResult) return j;
    if(j.until>Date.now()) throw Error('Nomor sedang diproses. Coba lanjutkan beberapa saat lagi.');
    j.until=Date.now()+420000;
    store.set(j);
    return j;
  });
  if(job.numberedResult) return job.numberedResult;
  function save(){store.set(job);}
  try {
    if(!job.submission) {
      var request=letterDraftRequest_(job.request,applicant,unit,token,job.previewDate);
      job.submission={applicantName:request.applicantName,unit:request.unit};
      save();
    }
    var file=DriveApp.getFileById(job.docId);
    var code=letterDraftNumber_(job,file,Object.assign({},job.request,job.submission,{token:token,requestToken:token}),job.previewDate,token,save);
    job.numberedResult={url:job.result.url,code:code};
    return job.numberedResult;
  } catch(e) {
    console.error('Pengajuan nomor dari pratinjau: '+e.message);
    if(job.number) throw Error('Nomor '+job.number+' telah terbit. '+toUserSafeError_(e));
    if(/^Nomor cadangan tidak tersedia/.test(e.message)) {
      delete job.submission;
      return {noSlot:true,message:e.message};
    }
    if(!job.number) {
      delete job.submission;
      return {invalid:true,message:toUserSafeError_(e)};
    }
    throw Error(toUserSafeError_(e));
  } finally {
    job.until=0;
    save();
  }
}
function includeLetterDrafts_() {
  try {letterDraftGuard_();} catch(e) {return '';}
  return '<aside class="letter-help"><div class="letter-help-links"><button type="button" id="draftGeneratorOpen" aria-haspopup="dialog" aria-controls="draftDialog">Generator Surat Dinas/Nota Dinas Resmi</button></div></aside>'+
    HtmlService.createHtmlOutputFromFile('LetterDraftsUI').getContent();
}

function letterDraftShare_(file) {
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.EDIT);
  if(file.getSharingAccess()!==DriveApp.Access.ANYONE_WITH_LINK ||
     file.getSharingPermission()!==DriveApp.Permission.EDIT) {
    throw Error('Tautan edit belum tersedia. Hubungi Bagian Umum.');
  }
}

// Run from the Apps Script editor as the owner before updating the live deployment.
function checkLetterDraftProduction_() {
  var mode=letterDraftGuard_();
  if(mode.staging || getDetectedEmail_().toLowerCase()!==APP.ADMIN_EMAIL.toLowerCase()) {
    throw Error('Pemeriksaan ini khusus pengelola SIDDIQ produksi.');
  }
  var officials=letterDraftOfficials_(mode), buildings=letterDraftBuildings_(mode);
  Object.keys(LETTER_DRAFT_TYPES).forEach(function(kind) {
    var id=LETTER_DRAFT_TYPES[kind][3];
    DocumentApp.openById(id).getBody().getChild(1).asParagraph();
  });
  var folder=finalPrivateChild_(finalRoot_(),'Draft dari Template Resmi');
  var doc=DocumentApp.create('SIDDIQ — Pemeriksaan akses dokumen kosong');
  var file=DriveApp.getFileById(doc.getId());
  try {
    doc.saveAndClose();
    file.moveTo(folder);
    letterDraftShare_(file);
  } finally {
    try {file.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.VIEW);}
    finally {file.setTrashed(true);}
  }
  console.log('SIDDIQ SIAP RILIS: '+officials.length+' pejabat, '+buildings.length+' gedung, 7 template, izin edit terverifikasi.');
}
