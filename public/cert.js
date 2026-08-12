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

var HOSP = {
  nameTh:'โรงพยาบาล ดับเบิ้ลยู เมดิคอล',
  license:'10201000265',
  addr:'99/26 หมู่ 5 ต.บางน้ำจืด อ.เมืองสมุทรสาคร จ.สมุทรสาคร 74000',
  addrLong:'เลขที่ 99/26 หมู่ 5 ตำบลบางน้ำจืด อำเภอเมืองสมุทรสาคร จังหวัดสมุทรสาคร 74000',
  tel:'034-110-988, 081-902-3540'
};

function esc(s){ if(s===null||s===undefined) return ''; return String(s).replace(/[&<>"]/g,function(x){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[x]}); }
function thDate(iso){ if(!iso) return '—'; var a=String(iso).slice(0,10).split('-').map(Number); return a[2]+' '+TH_M[a[1]-1]+' '+(a[0]+543); }
function ddmmyyyy(iso){ if(!iso) return ''; var a=String(iso).slice(0,10).split('-'); return a[2]+'-'+a[1]+'-'+a[0]; }
function addDays(iso,n){ var t=new Date(String(iso).slice(0,10)+'T00:00:00Z'); t.setUTCDate(t.getUTCDate()+n); return t.toISOString().slice(0,10); }
function today(){ return new Date().toISOString().slice(0,10); }
function daysLeft(c){ return Math.round((new Date(addDays(c.exam_date, c.valid_days||90)+'T00:00:00Z') - new Date(today()+'T00:00:00Z'))/86400000); }

function certStatus(c){
  if(c.status === 'void') return {cls:'bad', ic:'&#10005;', head:'ใบรับรองถูกยกเลิก', sub:'ใบรับรองฉบับนี้ถูกยกเลิกโดยโรงพยาบาล ไม่สามารถใช้อ้างอิงได้'};
  var exp = addDays(c.exam_date, c.valid_days||90), n = daysLeft(c);
  if(n < 0) return {cls:'bad', ic:'&#10005;', head:'ใบรับรองหมดอายุแล้ว', sub:'หมดอายุเมื่อ '+thDate(exp)+' ('+(-n)+' วันที่ผ่านมา)'};
  if(n <= 14) return {cls:'wn', ic:'!', head:'ใบรับรองใกล้หมดอายุ', sub:'เหลืออีก '+n+' วัน · หมดอายุ '+thDate(exp)};
  return {cls:'ok', ic:'&#10003;', head:'ใบรับรองถูกต้อง · ยังไม่หมดอายุ', sub:'เหลืออีก '+n+' วัน · หมดอายุ '+thDate(exp)};
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

  var corner = opts.qrId
    ? '<div id="'+opts.qrId+'" class="qrbox"></div><div class="hn">HN '+esc(c.hn)+'</div>'
    : '<div class="hn">HN '+esc(c.hn)+'</div>';

  return ''
  + '<div class="sheet">'
  + '<div class="hdr"><div class="lg"><img src="/logo.png" alt="โรงพยาบาล ดับเบิ้ลยู เมดิคอล"></div>'
  + '<div class="info">'+esc(HOSP.nameTh)+' ใบอนุญาตให้ดำเนินการสถานพยาบาลเลขที่ '+esc(HOSP.license)+'<br>ที่อยู่ '+esc(HOSP.addr)+'<br>โทร. '+esc(HOSP.tel)+'</div>'
  + '<div class="qrcol">เลขที่บัตรสถานพยาบาล'+corner+'</div></div>'
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
  + '<div class="ctr">สรุปผลการตรวจ</div>'
  + '<div class="sum"><ol>'
  + '<li><span class="n">1)</span><span class="bx">'+s1+'</span> สุขภาพสมบูรณ์ดี</li>'
  + '<li><span class="n">2)</span><span class="bx">'+s2+'</span> ผ่านการตรวจสุขภาพ แต่ต้องให้การรักษา ควบคุม ติดตามอย่างต่อเนื่อง</li>'
  + '<li><div class="dis">'+disHtml+'</div></li>'
  + '<li><span class="n">3)</span><span class="bx">'+s3+'</span> ไม่ผ่านการตรวจสุขภาพเนื่องจาก</li>'
  + '<li class="ind">3.1 ร่างกายทุพพลภาพจึงไม่สามารถประกอบการหาเลี้ยงชีพได้ / จิตฟั่นเฟือน ไม่สมประกอบ</li>'
  + '<li class="ind">3.2 เป็นโรคไม่อนุญาตให้ทำงาน และไม่ให้การประกันสุขภาพ (ตามประกาศกระทรวงสาธารณสุขฯ)</li>'
  + '</ol></div>'
  + '<div class="sign"><div class="role">แพทย์ผู้ตรวจ</div><div class="line">('+esc(c.doctor_name)+' ('+esc(c.doctor_license)+'))</div></div>'
  + '<div class="note">( ใบรับรองแพทย์ฉบับนี้ให้ใช้ได้ '+(c.valid_days||90)+' วัน นับแต่วันที่ตรวจร่างกาย )</div>'
  + '</div>';
}

var CERT_CSS = ''
+ '.sheet{width:860px;margin:0 auto;background:#fff;padding:26px 30px 22px;font-size:13.5px;line-height:1.5;color:#000}'
+ '.sheet *{box-sizing:border-box}'
+ '.hdr{display:flex;gap:12px;align-items:flex-start}'
+ '.hdr .lg{flex:0 0 62px;text-align:center}'
+ '.hdr .lg img{width:58px;height:auto;display:block;margin:0 auto}'
+ '.hdr .info{flex:1;font-weight:600;font-size:12.5px;line-height:1.65}'
+ '.hdr .qrcol{flex:0 0 130px;text-align:center;font-size:11.5px;font-weight:600}'
+ '.qrbox{margin:4px auto 2px;width:96px;height:96px}'
+ '.qrbox img,.qrbox canvas{width:96px !important;height:96px !important;display:block}'
+ '.hdr .hn{margin-top:4px;font-size:13px;color:#12428f;font-weight:700}'
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
+ '.sign .line{margin:26px auto 0;width:260px;border-top:1px dotted #666;padding-top:3px;font-weight:600}'
+ '.note{text-align:center;font-size:12px;margin-top:14px}';

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
    ? '<div id="'+opts.qrId+'" class="qrbox"></div><div class="hn">HN '+esc(c.hn)+'</div>'
    : '<div class="hn">HN '+esc(c.hn)+'</div>';
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
  + '<div class="fsign"><div class="line"></div><div class="nm">( นพ.มานิตย์   จารุวรรณ )</div></div>'
  + '<div class="rem">หมายเหตุ &nbsp;(1) ต้องเป็นแพทย์ซึ่งได้ขึ้นทะเบียนรับใบอนุญาตประกอบวิชาชีพเวชกรรม<br>'
  + '<span class="pad">(2) ให้แสดงว่าเป็นผู้มีร่างกายสมบูรณ์เพียงใด ใบรับรองแพทย์ฉบับนี้ให้ใช้ได้ '+(c.valid_days||30)+' วัน นับแต่วันที่ตรวจร่างกาย</span><br>'
  + '<span class="pad">(3) ใบรับรองแพทย์ฉบับนี้จะสมบูรณ์เมื่อประทับตราโรงพยาบาล</span></div>'
  + '</div>';
}
function thDay(iso){ if(!iso) return ''; return String(Number(String(iso).slice(8,10))); }
function thMonth(iso){ if(!iso) return ''; return TH_M[Number(String(iso).slice(5,7))-1]; }
function thYear(iso){ if(!iso) return ''; return String(Number(String(iso).slice(0,4))+543); }

function cornerOf(c, opts){
  return opts.qrId
    ? '<div id="'+opts.qrId+'" class="qrbox"></div><div class="hn">HN '+esc(c.hn)+'</div>'
    : '<div class="hn">HN '+esc(c.hn)+'</div>';
}
function hospHeader(corner){
  return '<div class="hdr"><div class="lg"><img src="/logo.png" alt="โรงพยาบาล ดับเบิ้ลยู เมดิคอล"></div>'
  + '<div class="info">'+esc(HOSP.nameTh)+' ใบอนุญาตให้ดำเนินการสถานพยาบาลเลขที่ '+esc(HOSP.license)+'<br>ที่อยู่ '+esc(HOSP.addr)+'<br>โทร. '+esc(HOSP.tel)+'</div>'
  + '<div class="qrcol">เลขที่บัตรสถานพยาบาล'+corner+'</div></div>';
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
  + '<p class="l">มีอาการ <span class="dot fill">'+esc(x.symptoms||'')+'</span></p>'
  + '<p class="l">การวินิจฉัยโรค <span class="dot fill">'+esc(x.diagnosis||'')+'</span></p>'
  + '<p class="l">ความเห็น <span class="dot fill">'+esc(x.opinion||'')+'</span></p>'
  + '<p class="l"><span class="dot fill"></span></p>'
  + '<div class="fsign"><div class="line"></div><div class="nm">('+esc(c.doctor_name)+' ('+esc(c.doctor_license)+'))</div><div>แพทย์ผู้ตรวจรักษา</div></div>'
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
  + '<div class="fsign"><div class="line"></div><div class="nm">('+esc(c.doctor_name)+' ('+esc(c.doctor_license)+'))</div><div>แพทย์ตรวจร่างกาย</div></div>'
  + '<div class="rem">หมายเหตุ &nbsp;(๑) ให้ประทับตราสถานพยาบาลพร้อมทั้งระบุที่อยู่<br>'
  + '<span class="pad">(๒) ต้องเป็นแพทย์ซึ่งได้ขึ้นทะเบียนรับใบอนุญาตประกอบวิชาชีพเวชกรรม</span><br>'
  + '<span class="pad">(๓) ให้แสดงว่าเป็นผู้ที่มีร่างกายสมบูรณ์เพียงใด ใบรับรองแพทย์ฉบับนี้ให้ใช้ได้ '+(c.valid_days||30)+' วัน นับแต่วันที่ตรวจร่างกาย</span></div>'
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
  + '<div class="fsign"><div class="line"></div><div class="nm">('+esc(c.doctor_name)+')</div><div>นายแพทย์ผู้ตรวจ / Signature M.D.</div></div>'
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
+ '.fsign .line{border-bottom:1px dotted #000;width:230px;margin:22px 0 3px auto}'
+ '.fsign .nm{font-weight:700;width:230px;margin-left:auto;text-align:center}'
+ '.rem{font-size:12px;margin-top:14px;line-height:1.6}.rem .pad{display:inline-block;padding-left:52px}';
