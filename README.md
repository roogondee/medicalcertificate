# ระบบใบรับรองแพทย์ — โรงพยาบาลดับเบิ้ลยู เมดิคอล

เว็บ static ล้วน (ไม่มี build step) + Supabase เป็นฐานข้อมูล/ระบบล็อกอิน

## โครงสร้าง

```
public/
  index.html   หน้าตรวจสอบสำหรับลูกค้า (เปิดจาก QR)  →  /?id=<HN>&k=<token>
  admin.html   ระบบหลังบ้านสำหรับเจ้าหน้าที่           →  /admin.html
  cert.js      ตัวเรนเดอร์ใบรับรอง (ใช้ร่วมกันทั้ง 2 หน้า) + CSS
  config.js    URL และ anon key ของ Supabase
vercel.json    ตั้ง framework = null (เว็บ static)
db/schema.sql  โครงฐานข้อมูล + RLS + ฟังก์ชันตรวจสอบสาธารณะ (รันไปแล้ว)
```

## แบบฟอร์มที่รองรับ

| form_type | ฟอร์ม | อายุ |
|---|---|---|
| `alien_worker` | ตรวจสุขภาพคนต่างด้าว/แรงงานต่างด้าว | 90 วัน |
| `five_disease` | ใบรับรองแพทย์ 5 โรค | 30 วัน |
| `driving` | ใบรับรองแพทย์สำหรับใบอนุญาตขับรถ (5 โรค + โรคลมชัก) | 30 วัน |
| `sick_leave` | ใบรับรองการตรวจรักษา / ใบลาป่วย | 30 วัน |
| `snor11` | ใบรับรองแพทย์ แบบ สณ.11 (ราชการ) | 30 วัน |
| `bilingual` | ใบรับรองแพทย์ 2 ภาษา ไทย-อังกฤษ (ปลอด 6 โรค + ตั้งครรภ์) | 30 วัน |

เพิ่มแบบฟอร์มใหม่: เขียนฟังก์ชัน `renderCertXxx(c, opts)` ใน `cert.js`
แล้วเพิ่มเงื่อนไขใน `renderCert()` — ฟิลด์เฉพาะฟอร์มเก็บในคอลัมน์ `extra` (jsonb)

## deploy

Vercel project: `medicalcertificate`
เชื่อม repo นี้กับ project แล้ว push ได้เลย — Vercel จะ deploy อัตโนมัติ
Root Directory เว้นว่าง, Framework Preset = Other

## ความปลอดภัย

- ตาราง `certificates` เปิดเฉพาะ role `authenticated` (RLS)
- หน้าลูกค้าเรียกผ่าน `verify_certificate(hn, token)` ซึ่งเป็น SECURITY DEFINER
  ต้องมี HN คู่กับ token ที่สุ่มไว้ถึงจะคืนข้อมูล และคืนเฉพาะฟิลด์ที่แสดงบนใบรับรอง
- anon ถูก revoke สิทธิ์บนตารางทั้งหมดแล้ว
- ทุกการเพิ่ม/แก้/ลบ บันทึกลง `cert_audit` อัตโนมัติผ่าน trigger
