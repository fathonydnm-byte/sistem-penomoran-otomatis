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
var LETTER_DRAFT_RECIPIENTS = [
  'Ketua dan Sekretaris Senat', 'Rektor', 'Seluruh Wakil Rektor', 'Wakil Rektor Bidang Akademik dan Kelembagaan',
  'Wakil Rektor Bidang Administrasi Umum, Perencanaan dan Keuangan', 'Wakil Rektor Bidang Kemahasiswaan dan Kerja Sama',
  'Kepala Biro AAKK', 'Kepala Biro AUPK', 'Direktur Pascasarjana', 'Dekan Fakultas', 'Wakil Direktur Pascasarjana',
  'Wakil Dekan Fakultas', 'Ketua LPM', 'Ketua LP2M', 'Kepala SPI', 'Wakil Koordinator Kopertais', 'Kepala UPT',
  'Ketua Program Studi dan Sekretaris Program Studi', 'Kepala Bagian Umum', 'Kepala Bagian Akademik',
  'Ketua Tim pada Biro AAKK/AUPK', 'Kepala Bagian Umum dan Kepala Subbagian Umum pada Fakultas/Pascasarjana',
  'Dosen', 'Tenaga Kependidikan'
];
function letterDraftGuard_() {
  if (ScriptApp.getScriptId() !== '1voCWP8UrNRyXNgCZPUaFkgmbZEKOzOZ1TodxLLuMb_kWT9BtxB5HiFlz') {
    throw Error('Generator surat tersedia di web app uji.');
  }
  bindChunkStaging_();
}
function letterDraftOfficials_() {
  var book = SpreadsheetApp.openById('1UR8puYkKdOKyMEqBbXYgBei1hNCvPSoMjGFkxTSgNhM');
  var sheet = book.getSheetByName('MASTER PEJABAT');
  return sheet.getRange(4,1,Math.max(1,sheet.getLastRow()-3),5).getDisplayValues().filter(function(r) {
    return r[1] && r[3] && r[4];
  }).map(function(r) {
    var id = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, r[2]+'|'+r[3]));
    return {id:id,code:r[0].trim(),name:r[1].trim(),nip:r[2].trim(),title:r[3].trim(),short:r[0]==='R2'&&r[4]==='Ali Musthofa'?'Ali Mustofa':r[4].trim()};
  });
}
function letterDraftBuildings_() {
  var sheet = getSpreadsheet_().getSheetByName('MASTER GEDUNG');
  if (!sheet || sheet.getLastRow()<2) return [{name:'Gedung Uji A (data buatan)',recipient:'Rektor'}];
  return sheet.getRange(2,1,sheet.getLastRow()-1,2).getDisplayValues().filter(function(r) {return r[0] && r[1];})
    .map(function(r) {return {name:r[0],recipient:r[1]};});
}
function getLetterDraftOptions() {
  letterDraftGuard_();
  return {
    officials:letterDraftOfficials_().map(function(o) {return {id:o.id, label:o.short+' — '+o.title, rector:o.code==='R'};}),
    types:Object.keys(LETTER_DRAFT_TYPES).map(function(k) {return {id:k,label:LETTER_DRAFT_TYPES[k][0],code:LETTER_DRAFT_TYPES[k][1]};}),
    urgency:LETTER_DRAFT_URGENCY, classifications:LETTER_DRAFT_CLASSIFICATIONS, recipients:LETTER_DRAFT_RECIPIENTS,
    buildings:letterDraftBuildings_().map(function(b) {return b.name;}), units:UNIT_OPTIONS, today:reservationDateKey_(new Date())
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
  if (!signer || (p.behalf && signer.code==='R')) throw Error('Penandatangan tidak valid.');
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
  var subject=free?field('subject','Perihal',300,true):kind[2], target=['Rektor'], body='';
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
  if (t==='SD') target=[field('target','Tujuan surat',250,true)];
  if (t==='KHUSUS'||t==='UNDANGAN') {
    if (!Array.isArray(p.recipients)||p.recipients.length>30) throw Error('Daftar penerima tidak valid.');
    target=p.recipients.map(function(x) {return letterDraftText_(x,150,'Penerima');}).filter(Boolean)
      .filter(function(x,i,a) {return a.findIndex(function(s) {return s.toLowerCase()===x.toLowerCase();})===i;});
    if (target.indexOf('Seluruh Wakil Rektor')>=0) target=target.filter(function(x) {return !/^Wakil Rektor Bidang /.test(x);});
    if (!target.length) throw Error('Tambahkan penerima.');
  }
  if (t==='GEDUNG') {
    var building=buildings.find(function(b) {return b.name===p.building;});
    if (!building) throw Error('Pilih gedung yang memiliki tujuan surat.');
    place=building.name;
    target=[building.recipient];
    subject+=' '+place.replace(/^Gedung /i,'');
  }
  if (t==='KENDARAAN') target=['Kepala Bagian Umum Kantor Pusat UIN Sunan Ampel Surabaya'];
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
      if (person[1]&&!/^\d{18}$/.test(person[1])) throw Error('NIP/NIPPPK harus 18 digit atau kosong.');
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
  letterDraftGuard_();
  var m=letterDraftModel_(p,letterDraftOfficials_(),letterDraftBuildings_());
  return {code:m.code,date:m.date,subject:m.subject,to:m.target,signer:m.signer.title,from:m.type==='SD'?m.signer.name:m.signer.short};
}
function letterDraftRender_(doc,m) {
  var body=doc.getBody();
  var children=Array.from({length:body.getNumChildren()},function(_,i) {return body.getChild(i);});
  function para(i) {return children[i].asParagraph();}
  function set(i,value,afterColon) {
    var p=para(i), t=p.editAsText(), old=t.getText(), start=0;
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
    set(7,m.target[0]);
    remove(8,8);
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
    remove(17,17);
    set(10,'Disampaikan dengan hormat, dalam rangka '+m.activity+', maka kami mengajukan permohonan kepada Bapak Rektor untuk berkenan menerbitkan SK pada kegiatan tersebut.');
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
    set(10,'Dalam rangka '+m.activity+', mohon perkenaan Bapak Rektor untuk memberikan izin dan menugaskan nama yang tersebut di bawah ini:');
    var existing=children[11].asTable();
    if(m.people.length===1) {
      m.people[0].forEach(function(value,i) {existing.getCell(i,1).editAsText().setText(': '+value);});
    } else {
      var pos=body.getChildIndex(existing);
      var table=body.insertTable(pos,[['No.','Nama','NIP/NIPPPK','Pangkat/Gol.','Jabatan']].concat(m.people.map(function(r,i){return [String(i+1)].concat(r);})));
      table.getRow(0).editAsText().setBold(true);
      existing.removeFromParent();
    }
    set(12,'Hari dan tanggal penugasan '+m.eventDate+' di '+m.place+'.');
  }
  if(type==='GEDUNG'||type==='KENDARAAN') {
    if(type==='GEDUNG') set(3,m.target[0],true);
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
  lock.waitLock(15000);
  try {return fn();} finally {lock.releaseLock();}
}
function createLetterDraft(p, token, withNumber) {
  letterDraftGuard_();
  if (!/^[0-9a-f-]{36}$/i.test(token||'')) throw Error('Identitas proses tidak valid.');
  var props=PropertiesService.getScriptProperties(), key='LETTER_DRAFT_'+token;
  var digest=Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify([p,!!withNumber])));
  var job=letterDraftLock_(function() {
    var j=JSON.parse(props.getProperty(key)||'{}');
    if(j.hash && j.hash!==digest) throw Error('Data berubah. Mulai proses baru.');
    if(j.done) return j;
    if(j.until>Date.now()) throw Error('Surat sedang diproses. Coba lanjutkan beberapa saat lagi.');
    j.hash=digest;
    j.until=Date.now()+420000;
    props.setProperty(key,JSON.stringify(j));
    return j;
  });
  if(job.done) return job.result;
  function save(){props.setProperty(key,JSON.stringify(job));}
  try {
    var m=letterDraftModel_(p,letterDraftOfficials_(),letterDraftBuildings_());
    if(withNumber) {
      [m.subject,m.target.join(', '),p.applicant].forEach(function(value) {
        if (/^\s*=/.test(value||'')) throw Error('Isian register tidak boleh dimulai dengan tanda sama dengan.');
      });
      validatePublicFields_({documentType:m.type==='SD'?'Surat Dinas':'Nota Dinas',subject:m.subject,
        from:m.type==='SD'?m.signer.name:m.signer.short,to:m.target.join(', '),applicantName:cleanText_(p.applicant,150),unit:p.unit,token:token});
      if(p.date>reservationDateKey_(new Date())) throw Error('Tanggal surat mendatang belum dapat diajukan.');
    }
    var folder=getOrCreateFolder_(DriveApp.getFolderById(APP.ROOT_FOLDER_ID),'Draft Generator Surat Uji');
    if(!job.docId) {
      var file=DriveApp.getFileById(m.kind[3]).makeCopy('UJI — '+m.subject+' — '+token,folder);
      try {
        var doc=DocumentApp.openById(file.getId());
        letterDraftRender_(doc,m);
        doc.saveAndClose();
        job.docId=file.getId();
        job.code=m.code;
        save();
      } catch(e) {
        file.setTrashed(true);
        throw e;
      }
    }
    if(withNumber && !job.archived) {
      var pdf=DriveApp.getFileById(job.docId).getAs(MimeType.PDF).setName('Draft Generator Surat.pdf');
      var reservation=reserveRequest({documentType:m.type==='SD'?'Surat Dinas':'Nota Dinas',subject:m.subject,
        from:m.type==='SD'?m.signer.name:m.signer.short,to:m.target.join(', '),applicantName:p.applicant,unit:p.unit,
        requestToken:token,letterDate:p.date===reservationDateKey_(new Date())?'':p.date,draftName:pdf.getName(),draftSize:pdf.getBytes().length});
      job.number=reservation.number;
      save();
      if(!reservation.uploadComplete) uploadDraft({reservedRequestId:reservation.requestId,requestToken:token,draft:pdf});
      job.archived=true;
      save();
    }
    if(withNumber) {
      var output=DocumentApp.openById(job.docId), numberLine=output.getBody().getChild(1).asParagraph();
      numberLine.replaceText('\\[BELUM BERNOMOR\\]',String(job.number));
      output.saveAndClose();
    }
    job.result={url:'https://docs.google.com/document/d/'+job.docId+'/edit',code:job.code.replace(LETTER_DRAFT_PENDING,withNumber?String(job.number):LETTER_DRAFT_PENDING)};
    job.done=true;
    return job.result;
  } catch(e) {
    console.error('Generator surat: '+e.message);
    if(job.number) throw Error('Nomor '+job.number+' telah terbit. Gunakan Lanjutkan proses untuk menyelesaikan dokumen.');
    if (/^Nomor cadangan tidak tersedia/.test(e.message)) {
      return {noSlot:true,message:e.message};
    }
    throw Error(toUserSafeError_(e));
  } finally {
    job.until=0;
    save();
  }
}
function includeLetterDrafts_() {
  try {letterDraftGuard_();} catch(e) {return '';}
  return '<aside class="letter-help"><div class="letter-help-links"><button type="button" id="draftGeneratorOpen" aria-haspopup="dialog">Buat surat dengan template resmi</button></div></aside>'+
    HtmlService.createHtmlOutputFromFile('LetterDraftsUI').getContent();
}
