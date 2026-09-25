/* Shared certificate renderer — used by the public page and the admin print view */
var TH_M = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

var TESTS = [
  ['tb','ผลการตรวจวัณโรค','ปกติ','ผิดปกติ/ให้รักษา','ระยะอันตราย'],
  ['leprosy','ผลการตรวจโรคเรื้อน','ปกติ','ผิดปกติ/ให้รักษา','ระยะติดต่อ/อาการเป็นที่รังเกียจ'],
  ['filaria','ผลการตรวจโรคเท้าช้าง','ปกติ','ผิดปกติ/ให้รักษา','อาการเป็นที่รังเกียจ'],
  ['syphilis','ผลการตรวจโรคซิฟิลิส','ปกติ','ผิดปกติ/ให้รักษา','ระยะที่ ๓'],
  ['drugs','ผลการตรวจสารเสพติด','ปกติ','พบสารเสพติด','ให้ตรวจยืนยัน'],
  ['alcohol','ผลการตรวจอาการของโรคพิษสุราเรื้อรัง','ปกติ','ปรากฏอาการ','ให้ตรวจยืนยันการรักษา'],
  ['pregnancy','ผลการตรวจตั้งครรภ์','ไม่','ตั้งครรภ์','']
];
var VAL_COL = { normal:0, no:0, abnormal:1, yes:1, severe:2 };

/* วิธีตรวจมาตรฐานของแต่ละรายการ — แก้รายใบได้ที่ lab.methods ในหน้า admin */
var LAB_METHODS = {
  tb:        'เอกซเรย์ทรวงอก (CXR)',
  leprosy:   'ตรวจร่างกายโดยแพทย์',
  filaria:   'ตรวจร่างกายโดยแพทย์',
  syphilis:  'ตรวจเลือด (RPR/VDRL)',
  drugs:     'ตรวจปัสสาวะ (Immunoassay)',
  alcohol:   'ซักประวัติ/ตรวจร่างกายโดยแพทย์',
  pregnancy: 'ตรวจปัสสาวะ (Urine hCG)'
};

var HOSP = {
  nameTh:'โรงพยาบาล ดับเบิ้ลยู เมดิคอล',
  license:'10201000265',
  addr:'99/26 หมู่ 5 ต.บางน้ำจืด อ.เมืองสมุทรสาคร จ.สมุทรสาคร 74000',
  addrLong:'เลขที่ 99/26 หมู่ 5 ตำบลบางน้ำจืด อำเภอเมืองสมุทรสาคร จังหวัดสมุทรสาคร 74000',
  tel:'034-110-988, 081-902-3540'
};

function esc(s){ if(s===null||s===undefined) return ''; return String(s).replace(/[&<>"]/g,function(x){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[x]}); }
function photoUrl(path){ return path ? ((typeof CFG!=='undefined'?CFG.url:'') + '/storage/v1/object/public/' + path) : ''; }
function photoBox(c){ return c.photo_path ? '<img class="cphoto" src="'+esc(photoUrl(c.photo_path))+'" alt="รูปถ่ายผู้ตรวจ">' : ''; }
/* ---------- ผลแล็บตรวจสอบได้: ไทม์ไลน์ + ข้อมูลห้องปฏิบัติการ + รหัสผนึกผล ---------- */
function labOf(c){ return (c && c.lab) || {}; }
/* เจ้าหน้าที่มักพิมพ์ "ท.น.12345" ลงช่องเลขใบประกอบวิชาชีพ ทั้งที่ใบพิมพ์เติม "ท.น." ให้อยู่แล้ว
   ตัดคำนำหน้าที่ซ้ำออก เพื่อไม่ให้ขึ้นเป็น "ท.น. ท.น.12345" */
function mtLic(L){
  var v = L && L.mt_license ? String(L.mt_license).trim() : '';
  if(!v) return '';
  v = v.replace(/^\s*ท\s*\.?\s*น\s*\.?\s*/, '').trim();
  return v ? ' (ท.น. ' + v + ')' : '';
}
function hasLab(c){
  var L = labOf(c);
  return !!(L.lab_no || L.reported_at || L.mt_name || L.collected_at || L.xray_no);
}
function thTime(iso){
  if(!iso) return '';
  var d = new Date(iso);
  if(isNaN(d)) return '';
  try { return d.toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit', timeZone:'Asia/Bangkok'}) + ' น.'; }
  catch(e){ return d.toISOString().slice(11,16) + ' น.'; }
}
function thDateTime(iso){
  if(!iso) return '—';
  var d = new Date(iso);
  if(isNaN(d)) return thDate(iso);
  var ymd;
  try { ymd = d.toLocaleDateString('en-CA', {timeZone:'Asia/Bangkok'}); }
  catch(e){ ymd = d.toISOString().slice(0,10); }
  return thDate(ymd) + ' ' + thTime(iso);
}
function sealShort(c){ return c && c.seal ? String(c.seal).slice(0,10).toUpperCase() : ''; }
function methodOf(c, key){
  var m = labOf(c).methods || {};
  return m[key] || LAB_METHODS[key] || '';
}
/* รายการที่ตรวจจริง พร้อมวิธีตรวจกำกับ */
function testedList(c){
  var R = c.results || {};
  var done = TESTS.filter(function(t){ return R[t[0]] !== undefined && R[t[0]] !== null && R[t[0]] !== ''; });
  if(!done.length) return '';
  return '<div class="tested"><b>รายการที่ตรวจจริง ' + done.length + ' รายการ</b> '
    + done.map(function(t){
        var m = methodOf(c, t[0]);
        return esc(t[1].replace('ผลการตรวจ','')) + (m ? ' <i>(' + esc(m) + ')</i>' : '');
      }).join(' · ')
    + '</div>';
}
/* บรรทัดบอกบนใบพิมพ์ว่ามีผลเอกซเรย์/ผลแล็บฉบับเต็ม (รูป + ผลอ่าน) ให้ดูผ่าน QR — ตัวผลไม่พิมพ์ลงใบ */
function qrResultsNote(c, standalone){
  var parts = [];
  var nx = labFilesOf(c,'xray').length, nl = labFilesOf(c,'lab').length;
  if(hasXray(c)) parts.push('ผลเอกซเรย์' + (nx ? ' (' + nx + ' รูป)' : ''));
  if(hasLabResults(c)) parts.push('ผลแล็บ' + (nl ? ' (' + nl + ' ไฟล์)' : ''));
  if(!parts.length) return '';
  var txt = 'มี' + parts.join(' และ ') + 'พร้อมผลอ่านในระบบ — สแกน QR มุมขวาบนเพื่อเปิดดูรูปและผลอ่านฉบับเต็ม';
  return standalone ? '<div class="labfilenote solo">' + txt + '</div>' : '<div class="labfilenote">' + txt + '</div>';
}
/* บล็อกข้อมูลห้องปฏิบัติการบนใบพิมพ์ — ไม่มีข้อมูลแล็บ = ไม่แสดงอะไรเลย */
function labBlock(c){
  if(!hasLab(c)) return testedList(c) + qrResultsNote(c, true);
  var L = labOf(c);
  var row = function(k, v){ return v ? '<span class="k">' + k + '</span><span class="v2">' + esc(v) + '</span>' : ''; };
  var mt = L.mt_name ? L.mt_name + mtLic(L) : '';
  return '<div class="labbox">'
    + '<div class="labhd">ผลตรวจทางห้องปฏิบัติการ · ตรวจที่ห้องปฏิบัติการของ' + esc(HOSP.nameTh) + '</div>'
    + '<div class="labgrid">'
    +   row('เลขที่สิ่งส่งตรวจ (Lab No.)', L.lab_no)
    +   row('เลขที่ฟิล์มเอกซเรย์', L.xray_no)
    +   row('เก็บสิ่งส่งตรวจ', thDateTime(L.collected_at))
    +   row('รายงานผล', thDateTime(L.reported_at))
    +   row('ผู้รายงานผล', mt)
    + '</div>'
    + testedList(c)
    + qrResultsNote(c, false)
    + (c.seal
        ? '<div class="sealline">รหัสผนึกผล <b>' + esc(sealShort(c)) + '</b>'
          + (c.sealed_at ? ' · ผนึกเมื่อ ' + thDateTime(c.sealed_at) : '')
          + ' · สแกน QR มุมขวาบนเพื่อตรวจสอบว่าผลไม่ถูกแก้ย้อนหลัง</div>'
        : '')
    + '</div>';
}
/* ไทม์ไลน์การตรวจ — ใช้บนหน้าตรวจสอบของลูกค้า */
function timelineHtml(c){
  var L = labOf(c);
  var ev = [
    [L.registered_at, 'ลงทะเบียน / ยืนยันตัวผู้รับการตรวจ', c.photo_path ? 'มีรูปถ่ายขณะเข้ารับการตรวจ' : ''],
    [L.collected_at,  'เก็บสิ่งส่งตรวจ (เลือด / ปัสสาวะ)', L.lab_no ? 'Lab No. ' + L.lab_no : ''],
    [L.xray_at,       'เอกซเรย์ทรวงอก', L.xray_no ? 'ฟิล์มเลขที่ ' + L.xray_no : ''],
    [L.reported_at,   'ห้องปฏิบัติการรายงานผล',
        (L.mt_name ? 'ผู้รายงานผล ' + L.mt_name + mtLic(L) : '')],
    [c.lab_verified_at, 'นักเทคนิคการแพทย์รับรองผลแล็บ', ''],
    [c.confirmed_at,  'แพทย์รับรองผลการตรวจ', c.doctor_name ? c.doctor_name + ' (' + c.doctor_license + ')' : ''],
    [c.sealed_at,     'ผนึกผลตรวจ (ออกรหัสตรวจสอบ)', c.seal ? 'รหัส ' + sealShort(c) : '']
  ].filter(function(e){ return e[0]; });
  if(!ev.length) return '';
  return '<div class="tl"><h3>ไทม์ไลน์การตรวจจริง</h3>'
    + ev.map(function(e){
        return '<div class="tlrow"><span class="t">' + esc(thTime(e[0]) || thDate(e[0])) + '</span>'
          + '<span class="d"><b>' + esc(e[1]) + '</b>' + (e[2] ? '<small>' + esc(e[2]) + '</small>' : '') + '</span></div>';
      }).join('')
    + '</div>';
}
/* ไฟล์ผลตรวจ (รูปฟิล์มเอกซเรย์ / รูปใบรายงานผลแล็บ / PDF) — แต่ละไฟล์มี kind = 'xray' | 'lab'
   ไฟล์เก่าที่ยังไม่มี kind ให้ถือเป็นผลแล็บ */
function labFiles(c){ var f = labOf(c).files; return (f && f.length) ? f : []; }
function fileKind(f){ return (f && f.kind === 'xray') ? 'xray' : 'lab'; }
function labFilesOf(c, kind){ return labFiles(c).filter(function(f){ return fileKind(f) === kind; }); }
function isImgFile(f){
  return ((f.type||'').indexOf('image/') === 0) || /\.(jpe?g|png|webp|gif)$/i.test(f.path || '');
}
/* มีผลเอกซเรย์/ผลแล็บให้ลูกค้าดูหรือไม่ (รูปหรือผลอ่านอย่างใดอย่างหนึ่ง) */
function hasXray(c){ var L = labOf(c); return !!(labFilesOf(c,'xray').length || L.xray_reading || L.xray_result); }
function hasLabResults(c){ var L = labOf(c); return !!(labFilesOf(c,'lab').length || L.lab_reading || L.lab_result); }
function resultBadge(v){
  if(v === 'normal')   return '<span class="rsbadge ok">&#10003; ผลปกติ</span>';
  if(v === 'abnormal') return '<span class="rsbadge bad">&#9888; พบความผิดปกติ</span>';
  return '';
}
/* การ์ดไฟล์ 1 ใบ — i คือ index ในรายการ lab.files ทั้งหมด (ใช้ผูกกับ checkLabFiles) */
function labFileCard(f, i, big){
  var url = photoUrl(f.path);
  return '<a class="lf' + (big ? ' big' : '') + '" href="' + esc(url) + '" target="_blank" rel="noopener">'
    + (isImgFile(f) ? '<img src="' + esc(url) + '" alt="' + esc(f.name || '') + '" loading="lazy">' : '<span class="pdf">PDF</span>')
    + '<b>' + esc(f.name || (fileKind(f) === 'xray' ? 'ฟิล์มเอกซเรย์' : 'ใบรายงานผลห้องปฏิบัติการ')) + '</b>'
    + '<small id="lfck' + i + '" class="ck">' + (f.sha256 ? 'กำลังตรวจสอบไฟล์…' : 'กดเพื่อเปิดดู / บันทึก') + '</small>'
    + '</a>';
}
/* ส่วนผลเอกซเรย์ + ผลแล็บบนหน้าตรวจสอบของลูกค้า (เห็นเฉพาะเมื่อสแกน QR เท่านั้น — ไม่ขึ้นบนใบพิมพ์) */
function resultsSection(c, kind){
  var L = labOf(c);
  var all = labFiles(c);
  var isX = kind === 'xray';
  if(isX ? !hasXray(c) : !hasLabResults(c)) return '';
  var reading = isX ? L.xray_reading : L.lab_reading;
  var result  = isX ? L.xray_result  : L.lab_result;
  var meta = [];
  if(isX){
    if(L.xray_no) meta.push('ฟิล์มเลขที่ ' + L.xray_no);
    if(L.xray_at) meta.push('ถ่ายเมื่อ ' + thDateTime(L.xray_at));
    if(L.xray_reader) meta.push('ผู้อ่านฟิล์ม ' + L.xray_reader);
  } else {
    if(L.lab_no) meta.push('Lab No. ' + L.lab_no);
    if(L.collected_at) meta.push('เก็บสิ่งส่งตรวจ ' + thDateTime(L.collected_at));
    if(L.reported_at) meta.push('รายงานผล ' + thDateTime(L.reported_at));
    if(L.mt_name) meta.push('ผู้รายงานผล ' + L.mt_name + mtLic(L));
  }
  var cards = [];
  all.forEach(function(f, i){ if(fileKind(f) === kind) cards.push(labFileCard(f, i, isX)); });
  return '<div class="rs ' + (isX ? 'rs-xray' : 'rs-lab') + '">'
    + '<h3>' + (isX ? 'ผลเอกซเรย์ทรวงอก' : 'ผลตรวจทางห้องปฏิบัติการ') + resultBadge(result) + '</h3>'
    + (meta.length ? '<div class="rsmeta">' + esc(meta.join(' · ')) + '</div>' : '')
    + (cards.length ? '<div class="lfgrid' + (isX ? ' xg' : '') + '">' + cards.join('') + '</div>' : '')
    + (reading
        ? '<div class="rsread"><b>' + (isX ? 'ผลอ่านฟิล์ม' : 'ผลอ่าน / สรุปผลแล็บ') + '</b>' + esc(reading) + '</div>'
        : '<div class="rsread none">ยังไม่มีผลอ่านในระบบ</div>')
    + '</div>';
}
function labFilesHtml(c){
  var x = resultsSection(c, 'xray'), l = resultsSection(c, 'lab');
  if(!x && !l) return '';
  return '<div class="lfiles">' + x + l
    + '<p class="lfnote">กดที่รูปเพื่อเปิดดูเต็มหน้าจอหรือบันทึกลงเครื่อง'
    + ' · ระบบจะโหลดไฟล์มาคำนวณรหัสใหม่แล้วเทียบกับรหัสที่ผนึกไว้ให้เห็นกับตา'
    + ' · ผลเอกซเรย์และผลแล็บฉบับเต็มนี้แสดงเฉพาะเมื่อสแกน QR จากใบรับรองฉบับจริงเท่านั้น</p></div>';
}
/* โหลดไฟล์มาคำนวณ sha256 ใหม่ แล้วเทียบกับค่าที่ผนึกไว้ — เรียกหลังใส่ HTML ลงหน้าแล้ว */
function checkLabFiles(c){
  var fs = labFiles(c);
  if(!fs.length || !(window.crypto && crypto.subtle)) return;
  fs.forEach(function(f, i){
    var el = document.getElementById('lfck' + i);
    if(!el || !f.sha256) return;
    fetch(photoUrl(f.path))
      .then(function(r){ if(!r.ok) throw new Error('load'); return r.arrayBuffer(); })
      .then(function(buf){ return crypto.subtle.digest('SHA-256', buf); })
      .then(function(h){
        var hex = Array.prototype.map.call(new Uint8Array(h), function(b){ return ('0'+b.toString(16)).slice(-2); }).join('');
        var ok = hex.toLowerCase() === String(f.sha256).toLowerCase();
        el.textContent = ok ? '✓ ไฟล์ตรงกับที่ผนึกไว้' : '⚠ ไฟล์ไม่ตรงกับที่ผนึกไว้';
        el.className = 'ck ' + (ok ? 'ok' : 'bad');
      })
      .catch(function(){ el.textContent = 'รหัสไฟล์ ' + String(f.sha256).slice(0,8).toUpperCase(); el.className = 'ck'; });
  });
}

/* แผงหลักฐานบนหน้าตรวจสอบของลูกค้า (QR) */
function evidencePanel(c){
  var tl = timelineHtml(c);
  var files = labFilesHtml(c);
  var seal = '';
  if(c.seal){
    seal = c.seal_ok === false
      ? '<div class="seal bad"><b>⚠ ข้อมูลผลตรวจไม่ตรงกับรหัสผนึก</b><small>ผลตรวจชุดนี้ถูกแก้ไขหลังการผนึก กรุณาติดต่อโรงพยาบาลเพื่อขอใบฉบับล่าสุด</small></div>'
      : '<div class="seal ok"><b>✓ ผลตรวจตรงกับรหัสผนึก ' + esc(sealShort(c)) + '</b><small>ผนึกเมื่อ ' + esc(thDateTime(c.sealed_at))
        + (c.seal_revision > 1 ? ' · ผนึกครั้งที่ ' + c.seal_revision + ' (มีการแก้ไขและรับรองใหม่)' : '')
        + ' — ไม่มีการแก้ไขข้อมูลย้อนหลัง</small></div>';
  }
  if(!tl && !seal && !files) return '';
  return '<div class="evid">' + seal + files + tl + '</div>';
}
function confirmBadge(c){
  var L = labOf(c);
  var parts = [];
  if(c.lab_verified_at){
    parts.push('ผลแล็บรับรองโดย ' + esc(L.mt_name || 'นักเทคนิคการแพทย์')
      + esc(mtLic(L)) + ' ' + thDate(c.lab_verified_at));
  }
  if(c.confirmed_at){
    parts.push('แพทย์รับรองผลโดย ' + esc(c.doctor_name) + ' (' + esc(c.doctor_license) + ') ' + thDate(c.confirmed_at));
  }
  if(c.seal){
    parts.push('รหัสผนึกผล ' + esc(sealShort(c)));
  }
  if(parts.length){
    return '<div class="confirmbadge ok">&#10003; ' + parts.join(' · ') + '</div>';
  }
  return '<div class="confirmbadge wait">ข้อมูลชุดนี้ยังไม่ได้รับการรับรองในระบบ — กรุณาตรวจสอบกับโรงพยาบาลโดยตรงหากมีข้อสงสัย</div>';
}
function thDate(iso){ if(!iso) return '—'; var a=String(iso).slice(0,10).split('-').map(Number); return a[2]+' '+TH_M[a[1]-1]+' '+(a[0]+543); }
function ddmmyyyy(iso){ if(!iso) return ''; var a=String(iso).slice(0,10).split('-'); return a[2]+'-'+a[1]+'-'+a[0]; }
function addDays(iso,n){ var t=new Date(String(iso).slice(0,10)+'T00:00:00Z'); t.setUTCDate(t.getUTCDate()+n); return t.toISOString().slice(0,10); }
function today(){ return new Date().toISOString().slice(0,10); }
function daysLeft(c){ return Math.round((new Date(addDays(c.exam_date, c.valid_days||90)+'T00:00:00Z') - new Date(today()+'T00:00:00Z'))/86400000); }

/* ลายเซ็นแพทย์จะขึ้นก็ต่อเมื่อแพทย์กด "รับรองผล" ในระบบแล้วเท่านั้น
   (ต้องการให้ขึ้นทุกใบเหมือนเดิม: ลบเงื่อนไข signed ออกจากบรรทัด if) */
function sigImg(c){
  var n = String((c && c.doctor_name) || '');
  var signed = !!(c && c.confirmed_at);
  if(signed && n.indexOf('มานิตย์') >= 0 && n.indexOf('จารุวรรณ') >= 0){
    return '<img class="sig" src="/sign.png" alt="">';
  }
  return '<span class="sig"></span>';
}
function certStatus(c){
  if(c.status === 'void') return {cls:'bad', ic:'&#10005;', head:'ใบรับรองถูกยกเลิก', sub:'ใบรับรองฉบับนี้ถูกยกเลิกโดยโรงพยาบาล ไม่สามารถใช้อ้างอิงได้'};
  var exp = addDays(c.exam_date, c.valid_days||90), n = daysLeft(c);
  if(n < 0) return {cls:'bad', ic:'&#10005;', head:'ใบรับรองหมดอายุแล้ว', sub:'หมดอายุเมื่อ '+thDate(exp)+' ('+(-n)+' วันที่ผ่านมา)'};
  if(n <= 14) return {cls:'wn', ic:'!', head:'ใบรับรองใกล้หมดอายุ', sub:'เหลืออีก '+n+' วัน · หมดอายุ '+thDate(exp)};
  return {cls:'ok', ic:'&#10003;', head:'ใบรับรองถูกต้อง · ยังไม่หมดอายุ', sub:'เหลืออีก '+n+' วัน · หมดอายุ '+thDate(exp)};
}

/* ลายเซ็นท้ายใบ: มีผลแล็บ = ลงนาม 2 ชั้น (ผู้รายงานผลแล็บ + แพทย์) */
function signRow(c){
  var L = labOf(c);
  var doc = '<div class="sign"><div class="role">แพทย์ผู้ตรวจ</div>'+sigImg(c)
    + '<div class="line">('+esc(c.doctor_name)+' ('+esc(c.doctor_license)+'))</div></div>';
  if(!L.mt_name) return doc;
  return '<div class="signs">'
    + '<div class="sign"><div class="role">ผู้รายงานผลห้องปฏิบัติการ</div><span class="sig"></span>'
    + '<div class="line">('+esc(L.mt_name)+esc(mtLic(L))+')</div></div>'
    + doc + '</div>';
}

/* มุมขวาบน: QR + คำบอกว่าสแกนไปทำอะไร + เลขที่ใบ + รูปถ่ายผู้ตรวจ */
function qrCorner(c, opts){
  opts = opts || {};
  var qr = opts.qrId
    ? '<div id="'+opts.qrId+'" class="qrbox"></div><div class="qrcap">สแกนตรวจสอบว่าเป็นใบจริง<br>และดูผลแล็บที่ตรวจจริง</div>'
    : '';
  return qr + '<div class="hn">เลขที่ใบ '+esc(c.hn)+'</div>' + photoBox(c);
}

/* opts.qrId = element id to mount a QR into (print view); opts.qrUrl = url to encode */
function renderCert(c, opts){
  opts = opts || {};
  var R = c.results || {};
  var rows = TESTS.map(function(t){
    var col = VAL_COL[R[t[0]]];
    if(col === undefined) col = 0;
    var cell = function(i, label){
      if(!label) return '<td class="o"></td>';
      return '<td class="o">'+esc(label)+'<span class="bx">'+(col===i?'&#10003;':'')+'</span></td>';
    };
    return '<tr><td>'+esc(t[1])+'</td>'+cell(0,t[2])+cell(1,t[3])+cell(2,t[4])+'</tr>';
  }).join('');

  var dis = ['วัณโรค','โรคเรื้อน','โรคเท้าช้าง','โรคซิฟิลิส'];
  var chosen = c.summary_diseases || [];
  var disHtml = dis.map(function(d){
    return '<span>'+esc(d)+'<span class="bx">'+(chosen.indexOf(d)>=0?'&#10003;':'')+'</span></span>';
  }).join('');

  var s1 = c.summary==='healthy' ? '&#10003;' : '';
  var s2 = c.summary==='treat'   ? '&#10003;' : '';
  var s3 = c.summary==='fail'    ? '&#10003;' : '';

  var corner = qrCorner(c, opts);

  return ''
  + '<div class="sheet">'
  + '<div class="hdr"><div class="lg"><img src="/logo.png" alt="โรงพยาบาล ดับเบิ้ลยู เมดิคอล"></div>'
  + '<div class="info">'+esc(HOSP.nameTh)+' ใบอนุญาตให้ดำเนินการสถานพยาบาลเลขที่ '+esc(HOSP.license)+'<br>ที่อยู่ '+esc(HOSP.addr)+'<br>โทร. '+esc(HOSP.tel)+'</div>'
  + '<div class="qrcol">'+corner+'</div></div>'
  + '<h1>ใบรับรองแพทย์</h1>'
  + '<div class="subrow"><div class="sub">การตรวจสุขภาพคนต่างด้าว/แรงงานต่างด้าว</div><div class="date">วันที่ '+thDate(c.exam_date)+'</div></div>'
  + '<div class="sec">๑. รายละเอียด/ประวัติส่วนตัวของผู้รับการตรวจสุขภาพ</div>'
  + '<div class="fld"><span class="lb">ชื่อ – สกุล (ภาษาอังกฤษ)</span><span class="v">'+esc(c.patient_name)+'</span><span class="lb">เลขประจำตัว/เลขที่ passport</span><span class="v">'+esc(c.doc_no)+'</span></div>'
  + '<div class="fld"><span class="lb">วัน/เดือน/ปีเกิด</span><span class="v sm">'+esc(ddmmyyyy(c.dob))+'</span><span class="lb">อายุ</span><span class="v sm">'+esc(c.age)+'</span><span class="lb">ปี เมืองที่เกิด</span><span class="v sm">'+esc(c.birth_city)+'</span><span class="lb">ประเทศ</span><span class="v sm">'+esc(c.country)+'</span><span class="lb">สัญชาติ</span><span class="v sm">'+esc(c.nationality)+'</span><span class="lb">อาชีพ</span><span class="v sm">'+esc(c.occupation)+'</span></div>'
  + '<div class="sec">๒. ข้อมูลนายจ้าง/สถานประกอบการ</div>'
  + '<div class="fld"><span class="lb">ชื่อนายจ้าง</span><span class="v">'+esc(c.employer_name)+'</span></div>'
  + '<div class="fld"><span class="lb">ที่อยู่นายจ้าง</span><span class="v">'+esc(c.employer_addr)+'</span></div>'
  + '<div class="sec">๓. ข้อมูลแพทย์ตรวจ</div>'
  + '<div class="fld"><span class="lb">นายแพทย์/แพทย์หญิง</span><span class="v">'+esc(c.doctor_name)+'</span></div>'
  + '<div class="fld"><span class="lb">ใบอนุญาตประกอบวิชาชีพเวชกรรมเลขที่</span><span class="v sm">'+esc(c.doctor_license)+'</span><span class="lb">สถานพยาบาลชื่อ</span><span class="v">'+esc(HOSP.nameTh)+'</span></div>'
  + '<div class="fld"><span class="lb">ที่อยู่</span><span class="v">'+esc(HOSP.addrLong)+'</span></div>'
  + '<div class="ctr">ผลการตรวจสุขภาพ</div>'
  + '<div class="fld"><span class="lb">ความสูง</span><span class="v sm">'+esc(c.height)+'</span><span class="lb">ซ.ม. น้ำหนัก</span><span class="v sm">'+esc(c.weight)+'</span><span class="lb">ก.ก. สีผิว</span><span class="v sm">'+esc(c.skin_color)+'</span></div>'
  + '<div class="fld"><span class="lb">สภาพร่างกาย จิตใจทั่วไป</span><span class="v">'+esc(c.general_condition)+'</span></div>'
  + '<table>'+rows+'</table>'
  + '<div class="fld"><span class="lb">ผลตรวจอื่นๆ (ถ้ามี)</span><span class="v">'+(c.other_results?esc(c.other_results):'–')+'</span></div>'
  + labBlock(c)
  + '<div class="ctr">สรุปผลการตรวจ</div>'
  + '<div class="sum"><ol>'
  + '<li><span class="n">1)</span><span class="bx">'+s1+'</span> สุขภาพสมบูรณ์ดี</li>'
  + '<li><span class="n">2)</span><span class="bx">'+s2+'</span> ผ่านการตรวจสุขภาพ แต่ต้องให้การรักษา ควบคุม ติดตามอย่างต่อเนื่อง</li>'
  + '<li><div class="dis">'+disHtml+'</div></li>'
  + '<li><span class="n">3)</span><span class="bx">'+s3+'</span> ไม่ผ่านการตรวจสุขภาพเนื่องจาก</li>'
  + '<li class="ind">3.1 ร่างกายทุพพลภาพจึงไม่สามารถประกอบการหาเลี้ยงชีพได้ / จิตฟั่นเฟือน ไม่สมประกอบ</li>'
  + '<li class="ind">3.2 เป็นโรคไม่อนุญาตให้ทำงาน และไม่ให้การประกันสุขภาพ (ตามประกาศกระทรวงสาธารณสุขฯ)</li>'
  + '</ol></div>'
  + signRow(c)
  + '<div class="note">( ใบรับรองแพทย์ฉบับนี้ให้ใช้ได้ '+(c.valid_days||90)+' วัน นับแต่วันที่ตรวจร่างกาย — ใช้ได้ถึงวันที่ '+thDate(addDays(c.exam_date, c.valid_days||90))+' )</div>'
  + confirmBadge(c)
  + '</div>';
}

var CERT_CSS = ''
+ '.sheet{width:100%;max-width:860px;margin:0 auto;background:#fff;padding:26px 30px 22px;font-size:13.5px;line-height:1.5;color:#000}'
+ '.sheet *{box-sizing:border-box}'
+ '.hdr{display:flex;gap:12px;align-items:flex-start}'
+ '.hdr .lg{flex:0 0 62px;text-align:center}'
+ '.hdr .lg img{width:58px;height:auto;display:block;margin:0 auto}'
+ '.hdr .info{flex:1;font-weight:600;font-size:12.5px;line-height:1.65}'
+ '.hdr .qrcol{flex:0 0 130px;text-align:center;font-size:11.5px;font-weight:600}'
+ '.qrbox{margin:4px auto 2px;width:96px;height:96px}'
+ '.qrbox img,.qrbox canvas{width:96px !important;height:96px !important;display:block}'
+ '.hdr .hn{margin-top:4px;font-size:13px;color:#12428f;font-weight:700}'
+ '.cphoto{width:64px;height:64px;object-fit:cover;border-radius:8px;margin:6px auto 0;display:block;border:1px solid #ccc}'
+ '.confirmbadge{margin-top:12px;padding:6px 10px;border-radius:8px;font-size:11px;text-align:center}'
+ '.confirmbadge.ok{background:#e7f6ee;color:#0f7a4d}'
+ '.confirmbadge.wait{background:#f1f3f6;color:#657288}'
+ '.sheet h1{text-align:center;font-size:17px;font-weight:700;margin:6px 0 2px}'
+ '.subrow{display:flex;align-items:flex-end;justify-content:center;position:relative}'
+ '.sub{text-align:center;font-size:14px;font-weight:600}'
+ '.date{position:absolute;right:0;bottom:0;font-size:13px;font-weight:600}'
+ '.sec{font-weight:700;margin-top:12px;font-size:13.5px}'
+ '.fld{margin:5px 0 0 22px;display:flex;flex-wrap:wrap;align-items:baseline;gap:0 4px}'
+ '.fld .lb{white-space:nowrap}'
+ '.v{font-weight:600;border-bottom:1px dotted #666;padding:0 8px;flex:1;min-width:70px;text-align:center}'
+ '.v.sm{flex:0 0 auto;min-width:52px}'
+ '.ctr{text-align:center;font-weight:700;margin:12px 0 6px;font-size:14px}'
+ '.sheet table{width:100%;border-collapse:collapse;font-size:13px}'
+ '.sheet td{padding:2.5px 0;vertical-align:middle}'
+ '.bx{display:inline-block;width:17px;height:17px;border:1px solid #000;text-align:center;line-height:15px;font-size:13px;font-weight:700;vertical-align:-3px;margin:0 5px}'
+ 'td.o{text-align:right;white-space:nowrap;padding-left:6px}'
+ '.sum li{list-style:none;margin:5px 0}.sum ol{padding:0;margin:0}'
+ '.sum .n{display:inline-block;width:26px}.sum .ind{margin-left:46px}'
+ '.dis{display:flex;gap:4px;margin:4px 0 4px 46px;flex-wrap:wrap}.dis span{white-space:nowrap}'
+ '.sign{margin-top:22px;text-align:center}.sign .role{font-weight:600}'
+ '.sign .line{margin:2px auto 0;width:260px;border-top:1px dotted #666;padding-top:3px;font-weight:600}'
+ '.sign .sig{display:block;height:44px;margin:6px auto -8px}'
+ '.note{text-align:center;font-size:12px;margin-top:14px}'
+ '.qrcap{font-size:9.5px;font-weight:600;line-height:1.35;color:#12428f;margin-top:1px}'
+ '.signs{display:flex;gap:18px;justify-content:space-around;align-items:flex-start}'
+ '.signs .sign{flex:1}'
+ '.labbox{margin-top:10px;border:1px solid #9bb0cd;border-radius:7px;padding:7px 10px;font-size:11.5px;line-height:1.55;background:#f7fafe}'
+ '.labhd{font-weight:700;color:#0b2f68;margin-bottom:3px;font-size:12px}'
+ '.labgrid{display:flex;flex-wrap:wrap;gap:1px 14px}'
+ '.labgrid .k{color:#4a5a72}.labgrid .v2{font-weight:700;margin-left:4px}'
+ '.labgrid .k:after{content:""}'
+ '.tested{margin-top:3px;padding-top:3px;border-top:1px dotted #9bb0cd}'
+ '.tested i{font-style:normal;color:#4a5a72}'
+ '.sealline{margin-top:3px;padding-top:3px;border-top:1px dotted #9bb0cd;letter-spacing:.2px}'
+ '.sealline b{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;letter-spacing:1.2px}'
/* แผงหลักฐานบนหน้าตรวจสอบของลูกค้า (ไม่ใช้ตอนพิมพ์) */
+ '.evid{width:100%;max-width:860px;margin:10px auto 0;background:#fff;border-radius:12px;padding:18px 22px;box-shadow:0 4px 20px rgba(0,0,0,.25);font-size:13.5px}'
+ '.evid .seal{border-radius:9px;padding:10px 14px;margin-bottom:14px}'
+ '.evid .seal b{display:block;font-size:14.5px}'
+ '.evid .seal small{display:block;margin-top:2px;line-height:1.6}'
+ '.evid .seal.ok{background:#e7f6ee;color:#0b5c3a}'
+ '.evid .seal.bad{background:#fdecec;color:#8f1b1b}'
+ '.evid h3{font-size:14.5px;color:#0b2f68;margin:0 0 8px}'
+ '.tlrow{display:flex;gap:12px;padding:7px 0;border-left:2px solid #d7e0ee;margin-left:6px;padding-left:14px;position:relative}'
+ '.tlrow:before{content:"";position:absolute;left:-6px;top:13px;width:9px;height:9px;border-radius:50%;background:#12428f}'
+ '.tlrow .t{flex:0 0 78px;font-weight:700;color:#12428f;font-variant-numeric:tabular-nums}'
+ '.tlrow .d b{display:block;font-weight:600}'
+ '.tlrow .d small{color:#657288}'
+ '.labfilenote{margin-top:3px;padding-top:3px;border-top:1px dotted #9bb0cd}'
+ '.labfilenote.solo{border-top:0;margin-top:6px;padding:4px 8px;font-size:11.5px;color:#0b2f68;background:#f7fafe;border:1px dashed #9bb0cd;border-radius:6px}'
+ '.lfiles{margin-bottom:16px}'
+ '.rs{margin-bottom:18px;padding:12px 14px;border:1px solid #d7e0ee;border-radius:12px;background:#fbfcfe}'
+ '.rs h3{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px}'
+ '.rs-xray h3:before{content:"";width:8px;height:8px;border-radius:50%;background:#12428f}'
+ '.rs-lab h3:before{content:"";width:8px;height:8px;border-radius:50%;background:#0f7a4d}'
+ '.rsmeta{font-size:12.5px;color:#657288;margin-bottom:10px;line-height:1.6}'
+ '.rsbadge{display:inline-block;font-size:12px;font-weight:600;padding:2px 10px;border-radius:99px}'
+ '.rsbadge.ok{background:#e7f6ee;color:#0f7a4d}.rsbadge.bad{background:#fdecec;color:#a11d1d}'
+ '.rsread{margin-top:10px;background:#fff;border-left:3px solid #12428f;border-radius:0 8px 8px 0;padding:10px 14px;white-space:pre-wrap;line-height:1.7;font-size:13.5px}'
+ '.rs-lab .rsread{border-left-color:#0f7a4d}'
+ '.rsread b{display:block;font-size:12px;color:#657288;margin-bottom:2px}'
+ '.rsread.none{color:#98a2b5;font-style:italic;border-left-color:#d7e0ee}'
+ '.lfgrid.xg .lf.big{flex:1 1 260px;max-width:100%}'
+ '.lf.big img{height:auto;max-height:560px;object-fit:contain;background:#111}'
+ '.lfgrid{display:flex;gap:12px;flex-wrap:wrap}'
+ '.lf{flex:0 0 168px;display:block;text-decoration:none;color:inherit;border:1px solid #d7e0ee;border-radius:10px;padding:8px;background:#f7fafe}'
+ '.lf img{width:100%;height:112px;object-fit:cover;border-radius:6px;display:block;background:#e7edf6}'
+ '.lf .pdf{display:grid;place-items:center;height:112px;border-radius:6px;background:#e7edf6;color:#12428f;font-weight:700;font-size:20px}'
+ '.lf b{display:block;font-size:12.5px;margin-top:6px;line-height:1.4}'
+ '.lf .ck{display:block;font-size:11.5px;color:#657288;margin-top:2px}'
+ '.lf .ck.ok{color:#0f7a4d;font-weight:600}.lf .ck.bad{color:#a11d1d;font-weight:600}'
+ '.lfnote{font-size:12px;color:#657288;margin-top:8px;line-height:1.65}'
+ '@media print{.evid{display:none}}';

/* ---------- form 2: ใบรับรองแพทย์ 5 โรค ---------- */
var CO = {
  name:'บริษัท โรงพยาบาล ดับเบิ้ลยู  เมดิคอล จำกัด',
  addr:'99/26 หมู่ที่ 5  ต.บางน้ำจืด  อ.เมืองสมุทรสาคร  จ.สมุทรสาคร  74000',
  tel:'081-902-3540',
  tax:'0105557091008'
};
var FIVE = ['วัณโรคในระยะอันตราย',
  'โรคเท้าช้างในระยะที่ปรากฏอาการเป็นที่รังเกียจแก่สังคม',
  'โรคติดยาเสพติดให้โทษ',
  'โรคพิษสุราเรื้อรัง',
  'โรคติดต่อร้ายแรงหรือโรคเรื้อรังที่ปรากฏอาการเด่นชัดหรือรุนแรงและเป็นอุปสรรคต่อการปฏิบัติงานในหน้าที่'];

function nidBoxes(v){
  var s = String(v||'').replace(/\D/g,'');
  var g = [1,4,5,2,1], out = [], i = 0;
  return g.map(function(n){
    var cell = '';
    for(var k=0;k<n;k++){ cell += '<i>'+(s[i]||'')+'</i>'; i++; }
    return cell;
  }).join('<u>-</u>');
}
function bx(on){ return '<span class="bx">'+(on?'&#10003;':'')+'</span>'; }

function renderCertFive(c, opts){
  opts = opts || {};
  var x = c.extra || {};
  var drv = c.form_type === 'driving';
  var corner = opts.qrId
    ? '<div id="'+opts.qrId+'" class="qrbox"></div><div class="hn">HN '+esc(c.hn)+'</div>'+photoBox(c)
    : '<div class="hn">HN '+esc(c.hn)+'</div>'+photoBox(c);
  var yn = function(v, detail, label){
    return bx(v!=='yes')+' ไม่มี &nbsp;'+bx(v==='yes')+' มี  (ระบุ) <span class="dot">'+esc(detail||'')+'</span>';
  };
  return ''
  + '<div class="sheet five">'
  + '<div class="fhdr"><div class="lg"><img src="/logo.png" alt="โรงพยาบาล ดับเบิ้ลยู เมดิคอล"></div>'
  + '<div class="co"><b>'+esc(CO.name)+'</b><br>ที่อยู่ '+esc(CO.addr)+'<br>โทร '+esc(CO.tel)+' &nbsp; เลขประจำตัวผู้เสียภาษีอากร '+esc(CO.tax)+'</div>'
  + '<div class="qrcol">'+corner+'</div></div>'
  + '<div class="bkno">เล่มที่ <span class="dot w90">'+esc(x.book_no||'')+'</span> &nbsp;&nbsp; เลขที่ <span class="dot w110">'+esc(c.hn)+'</span></div>'
  + '<div class="part">ส่วนที่ 1</div><div class="partt">ของผู้ขอรับใบรับรองสุขภาพ</div>'
  + '<p class="l">ข้าพเจ้า  นาย/นาง/นางสาว <span class="dot fill">'+esc(c.patient_name)+'</span></p>'
  + '<p class="l">สถานที่อยู่ (ที่สามารถติดต่อได้) <span class="dot fill">'+esc(x.contact_addr||'')+'</span></p>'
  + '<p class="l">หมายเลขบัตรประจำตัวประชาชน <span class="nid">'+nidBoxes(x.national_id||c.doc_no)+'</span></p>'
  + '<p class="l">ข้าพเจ้าขอใบรับรองสุขภาพ  โดยมีประวัติสุขภาพดังนี้</p>'
  + '<p class="l i">1. โรคประจำตัว &nbsp;'+yn(x.h_chronic, x.h_chronic_detail)+'</p>'
  + '<p class="l i">2. อุบัติเหตุ และ ผ่าตัด &nbsp;'+yn(x.h_accident, x.h_accident_detail)+'</p>'
  + '<p class="l i">3. เคยเข้ารับการรักษาในโรงพยาบาล &nbsp;'+yn(x.h_hospital, x.h_hospital_detail)+'</p>'
  + (drv ? '<p class="l i">4. โรคลมชัก &nbsp;'+yn(x.h_epilepsy, x.h_epilepsy_detail)+'</p>'
         + '<p class="l i">5. ประวัติอื่นที่สำคัญ <span class="dot fill">'+esc(x.h_other||'')+'</span></p>'
         + '<p class="note2" style="text-align:left;margin-left:26px">* ในกรณีมีโรคลมชัก ให้แนบประวัติการรักษาจากแพทย์ผู้รักษาว่าท่านปลอดจากอาการชักมากกว่า 1 ปี เพื่ออนุญาตให้ขับรถได้</p>'
       : '<p class="l i">4. ประวัติอื่นที่สำคัญ <span class="dot fill">'+esc(x.h_other||'')+'</span></p>')
  + '<p class="sgn">ลงชื่อ <span class="dot w180"></span> วันที่ <span class="dot w50">'+esc(thDay(c.exam_date))+'</span> เดือน <span class="dot w90">'+esc(thMonth(c.exam_date))+'</span> พ.ศ. <span class="dot w60">'+esc(thYear(c.exam_date))+'</span></p>'
  + (drv ? '' : '<p class="note2">(ในกรณีเด็กที่ไม่สามารถรับรองตนเองได้ให้ผู้ปกครองลงนามรับรองแทนได้)</p>')
  + '<div class="part">ส่วนที่ 2</div><div class="partt">ของแพทย์</div>'
  + '<p class="l">สถานที่ตรวจ <span class="dot w260">'+esc(x.exam_place||'โรงพยาบาลดับเบิ้ลยู เมดิคอล')+'</span> วันที่ <span class="dot w50">'+esc(thDay(c.exam_date))+'</span> เดือน <span class="dot w90">'+esc(thMonth(c.exam_date))+'</span> พ.ศ. <span class="dot w60">'+esc(thYear(c.exam_date))+'</span></p>'
  + '<p class="l">ข้าพเจ้านายแพทย์/แพทย์หญิง <span class="dot fill">'+esc(c.doctor_name)+'</span></p>'
  + '<p class="l">ใบอนุญาตประกอบวิชาชีพเวชกรรมเลขที่ <span class="dot w110">'+esc(String(c.doctor_license||'').replace(/^ว\./,''))+'</span> สถานพยาบาลชื่อ <span class="dot fill">โรงพยาบาลดับเบิ้ลยู เมดิคอล</span></p>'
  + '<p class="l">ที่อยู่ <span class="dot fill">'+esc(CO.addr)+'</span></p>'
  + '<p class="l">ได้ตรวจร่างกาย นาย / นาง / นางสาว <span class="dot fill">'+esc(c.patient_name)+'</span></p>'
  + '<p class="l">แล้วเมื่อวันที่ <span class="dot w50">'+esc(thDay(c.exam_date))+'</span> เดือน <span class="dot w90">'+esc(thMonth(c.exam_date))+'</span> พ.ศ. <span class="dot w60">'+esc(thYear(c.exam_date))+'</span> มีรายละเอียดดังนี้</p>'
  + '<p class="l i">น้ำหนักตัว <span class="dot w60">'+esc(c.weight)+'</span> กก. ความสูง <span class="dot w60">'+esc(c.height)+'</span> เซนติเมตร ความดันโลหิต <span class="dot w80">'+esc(x.bp||'')+'</span> มม.ปรอท ชีพจร <span class="dot w60">'+esc(x.pulse||'')+'</span> ครั้ง/นาที</p>'
  + '<p class="l i">สภาพร่างกายทั่วไปอยู่ในเกณฑ์ &nbsp;'+bx((x.general||'normal')==='normal')+' ปกติ &nbsp;&nbsp;'+bx(x.general==='abnormal')+' ผิดปกติ (ระบุ) <span class="dot w220">'+esc(x.general_detail||'')+'</span></p>'
  + '<p class="l j">ขอรับรองว่า บุคคลดังกล่าว ไม่เป็นผู้มีร่างกายทุพพลภาพจนไม่สามารถปฏิบัติหน้าที่ได้ ไม่ปรากฏอาการของโรคจิต หรือจิตฟั่นเฟือน หรือปัญญาอ่อน ไม่ปรากฏอาการของการติดยาเสพติดให้โทษ และอาการของโรคพิษสุราเรื้อรัง และไม่ปรากฏอาการและอาการแสดงของโรคต่อไปนี้</p>'
  + '<ol class="five5">'+FIVE.map(function(d){ return '<li>'+esc(d)+'</li>'; }).join('')+'</ol>'
  + '<p class="l">สรุปความเห็นและข้อแนะนำของแพทย์ <span class="dot fill">'+esc(x.doctor_opinion||'')+'</span></p>'
  + '<p class="l"><span class="dot fill"></span></p>'
  + '<div class="fsign">'+sigImg(c)+'<div class="line"></div><div class="nm">( '+esc(c.doctor_name)+' )</div></div>'
  + '<div class="rem">หมายเหตุ &nbsp;(1) ต้องเป็นแพทย์ซึ่งได้ขึ้นทะเบียนรับใบอนุญาตประกอบวิชาชีพเวชกรรม<br>'
  + '<span class="pad">(2) ให้แสดงว่าเป็นผู้มีร่างกายสมบูรณ์เพียงใด ใบรับรองแพทย์ฉบับนี้ให้ใช้ได้ '+(c.valid_days||30)+' วัน นับแต่วันที่ตรวจร่างกาย</span><br>'
  + '<span class="pad">(3) ใบรับรองแพทย์ฉบับนี้จะสมบูรณ์เมื่อประทับตราโรงพยาบาล</span></div>'
  + confirmBadge(c)
  + '</div>';
}
function thDay(iso){ if(!iso) return ''; return String(Number(String(iso).slice(8,10))); }
function thMonth(iso){ if(!iso) return ''; return TH_M[Number(String(iso).slice(5,7))-1]; }
function thYear(iso){ if(!iso) return ''; return String(Number(String(iso).slice(0,4))+543); }

function cornerOf(c, opts){ return qrCorner(c, opts); }
function hospHeader(corner){
  return '<div class="hdr"><div class="lg"><img src="/logo.png" alt="โรงพยาบาล ดับเบิ้ลยู เมดิคอล"></div>'
  + '<div class="info">'+esc(HOSP.nameTh)+' ใบอนุญาตให้ดำเนินการสถานพยาบาลเลขที่ '+esc(HOSP.license)+'<br>ที่อยู่ '+esc(HOSP.addr)+'<br>โทร. '+esc(HOSP.tel)+'</div>'
  + '<div class="qrcol">'+corner+'</div></div>';
}

/* ---------- form 3: ใบรับรองการตรวจรักษา (ใบลาป่วย) ---------- */
function renderCertSick(c, opts){
  opts = opts || {};
  var x = c.extra || {};
  return ''
  + '<div class="sheet five">'
  + hospHeader(cornerOf(c, opts))
  + '<h1>ใบรับรองแพทย์</h1>'
  + '<div class="subrow"><div class="sub">ใบรับรองการตรวจรักษา</div><div class="date">วันที่ '+thDate(c.exam_date)+'</div></div>'
  + '<p class="l" style="margin-top:14px">ข้าพเจ้า <span class="dot fill">'+esc(c.doctor_name)+'</span></p>'
  + '<p class="l">ใบอนุญาตประกอบวิชาชีพเวชกรรมเลขที่ <span class="dot w110">'+esc(c.doctor_license)+'</span> สถานพยาบาลชื่อ <span class="dot fill">'+esc(HOSP.nameTh)+'</span></p>'
  + '<p class="l">ได้ทำการตรวจรักษา นาย/นาง/นางสาว <span class="dot fill">'+esc(c.patient_name)+'</span></p>'
  + '<p class="l">เมื่อวันที่ <span class="dot w180">'+thDate(c.exam_date)+'</span></p>'
  + '<p class="l">มีอาการ <span class="dot fill">'+(x.symptoms==='__redacted__'?'<i>— แสดงเฉพาะบนใบรับรองฉบับจริง —</i>':esc(x.symptoms||''))+'</span></p>'
  + '<p class="l">การวินิจฉัยโรค <span class="dot fill">'+(x.diagnosis==='__redacted__'?'<i>— แสดงเฉพาะบนใบรับรองฉบับจริง —</i>':esc(x.diagnosis||''))+'</span></p>'
  + '<p class="l">ความเห็น <span class="dot fill">'+esc(x.opinion||'')+'</span></p>'
  + '<p class="l"><span class="dot fill"></span></p>'
  + '<div class="fsign">'+sigImg(c)+'<div class="line"></div><div class="nm">('+esc(c.doctor_name)+' ('+esc(c.doctor_license)+'))</div><div>แพทย์ผู้ตรวจรักษา</div></div>'
  + confirmBadge(c)
  + '</div>';
}

/* ---------- form 4: แบบ สณ.๑๑ ---------- */
var SN_DISEASES = ['วัณโรค','อหิวาตกโรค','ไข้รากสาดน้อย (ไทฟอยด์)','โรคบิด','ไข้สุกใส',
  'โรคคางทูม','โรคเรื้อน','โรคผิวหนังที่น่ารังเกียจ','โรคตับอักเสบที่เกิดจากไวรัส'];
function renderCertSnor11(c, opts){
  opts = opts || {};
  var x = c.extra || {};
  return ''
  + '<div class="sheet five">'
  + hospHeader(cornerOf(c, opts))
  + '<div class="bkno">แบบ สณ.๑๑</div>'
  + '<h1>ใบรับรองแพทย์</h1>'
  + '<div class="subrow"><div class="sub">สถานพยาบาล '+esc(HOSP.nameTh)+'</div><div class="date">วันที่ '+thDate(c.exam_date)+'</div></div>'
  + '<p class="l" style="margin-top:12px">ข้าพเจ้า นายแพทย์/แพทย์หญิง <span class="dot fill">'+esc(c.doctor_name)+'</span></p>'
  + '<p class="l j">แพทย์ปริญญา เป็นแพทย์ที่ได้ขึ้นทะเบียนและรับใบอนุญาตให้ผู้ประกอบโรคศิลปะแผนปัจจุบันชั้นหนึ่ง สาขาเวชกรรม</p>'
  + '<p class="l">ใบอนุญาตประกอบวิชาชีพเวชกรรมเลขที่ <span class="dot w110">'+esc(c.doctor_license)+'</span> ตำแหน่งหน้าที่ <span class="dot w180">'+esc(x.position||'แพทย์ผู้ตรวจ')+'</span></p>'
  + '<p class="l">ประจำโรงพยาบาล <span class="dot fill">'+esc(HOSP.nameTh)+'</span></p>'
  + '<p class="l">ได้ทำการตรวจร่างกาย (นาย/นาง/น.ส.) <span class="dot fill">'+esc(c.patient_name)+'</span></p>'
  + '<p class="l">อายุ <span class="dot w60">'+esc(c.age)+'</span> ปี เมื่อวันที่ <span class="dot w50">'+esc(thDay(c.exam_date))+'</span> เดือน <span class="dot w90">'+esc(thMonth(c.exam_date))+'</span> พ.ศ. <span class="dot w60">'+esc(thYear(c.exam_date))+'</span> แล้ว</p>'
  + '<p class="l j">ปรากฏว่า (นาย/นาง/น.ส.) <span class="dot fill">'+esc(c.patient_name)+'</span> ไม่เป็นผู้มีร่างกายทุพพลภาพจนไม่สามารถปฏิบัติหน้าที่ได้ ไร้ความสามารถหรือจิตฟั่นเฟือนไม่สมประกอบ และปราศจากโรคเหล่านี้</p>'
  + '<ul class="snlist">'+SN_DISEASES.map(function(d){ return '<li>'+esc(d)+'</li>'; }).join('')+'</ul>'
  + '<p class="l">โรคอื่น ๆ <span class="dot fill">'+esc(x.other_diseases||'–')+'</span></p>'
  + '<p class="l">สรุปความเห็นและข้อแนะนำของแพทย์ <span class="dot fill">'+esc(x.sn_opinion||'')+'</span></p>'
  + '<p class="l"><span class="dot fill"></span></p>'
  + '<div class="fsign">'+sigImg(c)+'<div class="line"></div><div class="nm">('+esc(c.doctor_name)+' ('+esc(c.doctor_license)+'))</div><div>แพทย์ตรวจร่างกาย</div></div>'
  + '<div class="rem">หมายเหตุ &nbsp;(๑) ให้ประทับตราสถานพยาบาลพร้อมทั้งระบุที่อยู่<br>'
  + '<span class="pad">(๒) ต้องเป็นแพทย์ซึ่งได้ขึ้นทะเบียนรับใบอนุญาตประกอบวิชาชีพเวชกรรม</span><br>'
  + '<span class="pad">(๓) ให้แสดงว่าเป็นผู้ที่มีร่างกายสมบูรณ์เพียงใด ใบรับรองแพทย์ฉบับนี้ให้ใช้ได้ '+(c.valid_days||30)+' วัน นับแต่วันที่ตรวจร่างกาย</span></div>'
  + confirmBadge(c)
  + '</div>';
}

/* ---------- form 5: ใบรับรองแพทย์ 2 ภาษา (ไทย-อังกฤษ) ---------- */
var BI_DISEASES = [
  ['โรคเรื้อน','LEPROSY'],
  ['วัณโรคระยะแพร่กระจายเชื้อ','PULMONARY TUBERCULOSIS'],
  ['โรคเท้าช้างในระยะที่ปรากฏอาการเป็นที่รังเกียจต่อสังคม','ELEPHANTIASIS'],
  ['โรคติดยาเสพติดให้โทษ','DRUG ADDICTION'],
  ['โรคพิษสุราเรื้อรัง','CHRONIC ALCOHOLISM'],
  ['โรคซิฟิลิสในระยะที่ 3','THIRD STEP OF SYPHILIS'],
  ['การตั้งครรภ์','PREGNANCY']
];
function renderCertBilingual(c, opts){
  opts = opts || {};
  var x = c.extra || {};
  return ''
  + '<div class="sheet five">'
  + hospHeader(cornerOf(c, opts))
  + '<h1>ใบรับรองแพทย์<span class="en" style="text-align:center">MEDICAL CERTIFICATE</span></h1>'
  + '<p class="l" style="margin-top:10px;text-align:right">วันที่ <span class="dot w180">'+thDate(c.exam_date)+'</span><span class="en" style="text-align:right">Date</span></p>'
  + '<p class="l">ข้าพเจ้า นายแพทย์ <span class="dot fill">'+esc(c.doctor_name)+'</span> แพทย์แผนปัจจุบันชั้นหนึ่ง<span class="en">Name '+esc(c.doctor_name)+', a medical doctor</span></p>'
  + '<p class="l">ใบอนุญาตประกอบวิชาชีพ เลขที่ <span class="dot w110">'+esc(c.doctor_license)+'</span> ออกให้ ณ วันที่ <span class="dot w180">'+esc(x.license_issued||'29 เมษายน 2525')+'</span><span class="en">Holding medical license No. '+esc(String(c.doctor_license||'').replace(/^ว\./,''))+'</span></p>'
  + '<p class="l">ได้ทำการตรวจร่างกายของ <span class="dot fill">'+esc(c.patient_name)+'</span> เมื่อวันที่ <span class="dot w180">'+thDate(c.exam_date)+'</span><span class="en">Have examined (name) on date</span></p>'
  + '<p class="l">เลขที่บัตรประชาชน/หนังสือเดินทางเลขที่ <span class="dot w260">'+esc(c.doc_no)+'</span><span class="en">ID Card / Passport No.</span></p>'
  + '<p class="l">แล้วปรากฏว่า <span class="dot fill">'+esc(c.patient_name)+'</span> ปราศจากโรคดังต่อไปนี้<span class="en">And have found (name) free from the following diseases:</span></p>'
  + '<ul class="bilist">'+BI_DISEASES.map(function(d){ return '<li>'+esc(d[0])+'<span class="en">'+esc(d[1])+'</span></li>'; }).join('')+'</ul>'
  + '<p class="l j"><span class="dot fill">'+esc(c.patient_name)+'</span> เป็นผู้มีร่างกายแข็งแรงสมบูรณ์ ไม่เป็นผู้มีจิตฟั่นเฟือนหรือไม่สมประกอบ หรือไม่เป็นผู้ที่มีร่างกายทุพพลภาพ หรือเป็นโรคดังกล่าวข้างต้น<span class="en">(name) is in good physical and mental health, free from any defect.</span></p>'
  + '<div class="fsign">'+sigImg(c)+'<div class="line"></div><div class="nm">('+esc(c.doctor_name)+')</div><div>นายแพทย์ผู้ตรวจ / Signature M.D.</div></div>'
  + confirmBadge(c)
  + '</div>';
}

var renderCertAlien = renderCert;
renderCert = function(c, opts){
  var t = c && c.form_type;
  if(t === 'five_disease' || t === 'driving') return renderCertFive(c, opts);
  if(t === 'sick_leave')  return renderCertSick(c, opts);
  if(t === 'snor11')      return renderCertSnor11(c, opts);
  if(t === 'bilingual')   return renderCertBilingual(c, opts);
  return renderCertAlien(c, opts);
};

CERT_CSS += ''
+ '.five{font-size:13.5px;line-height:1.75}'
+ '.fhdr{display:flex;gap:12px;align-items:flex-start;margin-bottom:2px}'
+ '.fhdr .lg{flex:0 0 54px}.fhdr .lg img{width:52px;height:auto;display:block}'
+ '.fhdr .co{flex:1;font-size:13px;line-height:1.5}.fhdr .co b{font-size:15px}'
+ '.five .qrcol{flex:0 0 120px;text-align:center}'
+ '.bkno{text-align:right;font-size:13px;margin:2px 0 8px}'
+ '.part{display:inline-block;border:1.2px solid #000;border-radius:9px;padding:1px 14px;font-weight:700;font-size:13.5px}'
+ '.partt{display:inline-block;margin-left:14px;font-weight:700}'
+ '.five p.l{margin:3px 0}.five p.l.i{margin-left:26px}.five p.l.j{text-align:justify;margin-top:6px}'
+ '.dot{display:inline-block;border-bottom:1px dotted #000;min-width:60px;padding:0 6px;font-weight:600;text-align:center}'
+ '.dot.fill{min-width:60%}'
+ '.w50{min-width:50px}.w60{min-width:60px}.w80{min-width:80px}.w90{min-width:90px}.w110{min-width:110px}.w180{min-width:180px}.w220{min-width:220px}.w260{min-width:260px}'
+ '.nid i{display:inline-block;width:17px;height:20px;border:1px solid #000;text-align:center;line-height:19px;margin:0 1px;font-weight:600;font-style:normal}'
+ '.nid u{text-decoration:none;margin:0 2px}'
+ '.sgn{text-align:right;margin:10px 0 2px}'
+ '.note2{text-align:center;font-size:12px;margin-bottom:8px}'
+ '.five5{margin:4px 0 6px 46px;padding:0}.five5 li{margin:1px 0}'
+ '.en{display:block;font-size:11px;color:#555;font-weight:400;line-height:1.3}'
+ '.snlist{margin:6px 0 6px 46px;padding:0;columns:2;column-gap:44px;list-style-position:inside}.snlist li{margin:2px 0}'
+ '.bilist{margin:6px 0 6px 46px;padding:0;list-style-position:inside}.bilist li{margin:3px 0}.bilist li .en{margin-left:22px}'
+ '.fsign{text-align:right;margin:14px 60px 0 0}'
+ '.fsign .line{border-bottom:1px dotted #000;width:230px;margin:2px 0 3px auto}'
+ '.fsign .sig{display:block;height:44px;margin:6px 90px -10px auto}'
+ '.fsign .nm{font-weight:700;width:230px;margin-left:auto;text-align:center}'
+ '.rem{font-size:12px;margin-top:14px;line-height:1.6}.rem .pad{display:inline-block;padding-left:52px}';

/* ---------- จอเล็ก (มือถือ/แท็บเล็ต) — ใช้เฉพาะบนหน้าจอ ไม่แตะการพิมพ์ A4 ---------- */
CERT_CSS += ''
+ '@media screen and (max-width:900px){'
+   '.sheet{padding:18px 14px 16px;font-size:14px}'
/* หัวกระดาษ: โลโก้ + ข้อมูล รพ. + คอลัมน์ QR/รูป ให้ห่อบรรทัดได้ */
+   '.hdr,.fhdr{flex-wrap:wrap;gap:8px}'
+   '.hdr .lg,.fhdr .lg{flex:0 0 46px}'
+   '.hdr .lg img,.fhdr .lg img{width:44px}'
+   '.hdr .info{flex:1 1 60%;font-size:12px}'
+   '.fhdr .co{flex:1 1 60%;font-size:12px}'
+   '.hdr .qrcol,.five .qrcol{flex:1 1 100%;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px 12px;font-size:11px}'
+   '.hdr .hn{margin-top:0}'
+   '.cphoto{margin:0}'
/* วันที่เคยลอยทับหัวเรื่องเพราะ position:absolute */
+   '.subrow{flex-wrap:wrap;justify-content:center}'
+   '.date{position:static;width:100%;text-align:center;margin-top:2px}'
/* ช่องกรอกแบบเส้นประ */
+   '.fld{margin-left:0}'
+   '.v{min-width:90px}'
+   '.dot.fill{min-width:100%}'
+   '.w180,.w220,.w260{min-width:110px}'
+   '.nid i{width:15px;height:19px;line-height:18px;margin:0}'
/* ตารางผลตรวจ 4 คอลัมน์ล้นจอ -> เรียงเป็นบล็อกทีละรายการ */
+   '.sheet table{display:block;font-size:13.5px}'
+   '.sheet tbody,.sheet tr{display:block;width:100%}'
+   '.sheet tr{padding:6px 0;border-bottom:1px solid #eef1f5}'
+   '.sheet tr:last-child{border-bottom:0}'
+   '.sheet td{display:block;padding:0}'
+   '.sheet tr td:first-child{font-weight:600;margin-bottom:2px}'
+   'td.o{display:inline-block;width:auto;text-align:left;padding:0 14px 0 0}'
/* รายการ/ย่อหน้าที่เยื้องลึกเกินไปสำหรับจอแคบ */
+   '.sum .ind{margin-left:24px}'
+   '.dis{margin-left:24px}'
+   '.five p.l.i{margin-left:12px}'
+   '.five5{margin-left:22px}'
+   '.snlist{columns:1;margin-left:20px}'
+   '.bilist{margin-left:20px}'
+   '.bilist li .en{margin-left:0}'
+   '.rem .pad{padding-left:0}'
/* ลายเซ็น */
+   '.sign .line{width:auto;max-width:260px}'
+   '.fsign{margin:14px 0 0}'
+   '.fsign .sig{margin-right:40px}'
+   '.fsign .line,.fsign .nm{width:100%;max-width:230px}'
/* พาเนลหลักฐานผลแล็บ */
+   '.evid{padding:15px 16px}'
+   '.tlrow{flex-wrap:wrap;gap:2px 12px;padding-left:12px}'
+   '.tlrow .t{flex:0 0 100%}'
+   '.lfgrid{gap:10px}'
+   '.lf{flex:1 1 100%}'
+   '.lf img,.lf .pdf{height:150px}'
+ '}';
