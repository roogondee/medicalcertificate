-- =====================================================================
-- สะพานข้อมูลไปยัง roogondee.com
--
-- roogondee.com ใช้ข้อมูลใบรับรองจากระบบนี้ 2 อย่าง
--   1) พอร์ทัล HR + แจ้งเตือนครบรอบตรวจประจำปี (/hr, /admin/employers)
--      — เห็นเฉพาะใบที่นายจ้างใช้ยื่น (แรงงานต่างด้าว / 5 โรค / 2 ภาษา)
--        ของนายจ้างที่ระบุชื่อมาเท่านั้น ไม่มีผลแล็บ ไม่มีรูป ไม่มีที่อยู่
--   2) วัดผลโฆษณา — ใบที่เจ้าหน้าที่ใส่ "รหัสอ้างอิงจากเว็บ" (MC-xxxxx / CL-xxxxx)
--      ในช่อง extra.ref_code จะถูกนับเป็น "คนไข้มาตรวจจริง" ให้แคมเปญที่พามา
--
-- เรียกผ่าน anon key (สาธารณะอยู่แล้วใน config.js) + รหัสลับ p_secret
-- เก็บไว้เฉพาะ sha256 ของรหัสลับ ตัวจริงอยู่ใน Vercel ของ roogondee
-- (WMEDICAL_BRIDGE_SECRET) — ตั้ง/เปลี่ยนรหัสลับ:
--   insert into public.bridge_secret (id, secret_hash)
--   values (1, encode(extensions.digest('<รหัสลับ>', 'sha256'), 'hex'))
--   on conflict (id) do update set secret_hash = excluded.secret_hash, updated_at = now();
--
-- ทุกฟังก์ชันเป็น read-only และคืนเฉพาะคอลัมน์ที่ระบุ — รันซ้ำได้
-- =====================================================================

create table if not exists public.bridge_secret (
  id          int primary key default 1 check (id = 1),
  secret_hash text not null,
  updated_at  timestamptz not null default now()
);
alter table public.bridge_secret enable row level security;
-- ไม่มี policy โดยเจตนา: anon/authenticated อ่านไม่ได้ ใช้ได้ผ่านฟังก์ชันด้านล่างเท่านั้น
revoke all on public.bridge_secret from anon, authenticated;

create or replace function public.bridge_check(p_secret text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_secret is null or length(p_secret) < 32
     or encode(extensions.digest(p_secret, 'sha256'), 'hex')
        is distinct from (select secret_hash from public.bridge_secret where id = 1)
  then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end; $$;
revoke all on function public.bridge_check(text) from public, anon, authenticated;

-- ชื่อนายจ้างเทียบแบบไม่สนช่องว่างซ้ำ/ตัวพิมพ์ — เจ้าหน้าที่พิมพ์มือ
create or replace function public.bridge_norm(t text)
returns text language sql immutable as $$
  select regexp_replace(lower(btrim(coalesce(t, ''))), '\s+', ' ', 'g');
$$;

-- 1) ใบของพนักงานตามชื่อนายจ้าง (ไม่รวมใบลาป่วย ใบขับขี่ สณ.11 — เป็นเรื่องส่วนตัวของผู้ตรวจ)
create or replace function public.bridge_employer_certs(p_secret text, p_names text[])
returns table (
  id uuid, hn text, token text, form_type text, patient_name text, nationality text,
  doc_no text, employer_name text, exam_date date, valid_days int, summary text,
  confirmed_at timestamptz, sealed_at timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  perform public.bridge_check(p_secret);
  return query
    select c.id, c.hn, c.token, c.form_type, c.patient_name, c.nationality, c.doc_no,
           c.employer_name, c.exam_date, c.valid_days, c.summary, c.confirmed_at, c.sealed_at
      from public.certificates c
     where c.status is distinct from 'void'
       and c.form_type in ('alien_worker', 'five_disease', 'bilingual')
       and public.bridge_norm(c.employer_name) <> ''
       and public.bridge_norm(c.employer_name) = any (
             select public.bridge_norm(n) from unnest(coalesce(p_names, '{}')) n)
     order by c.exam_date desc
     limit 5000;
end; $$;

-- 2) รายชื่อนายจ้างที่มีในใบ — ให้เจ้าหน้าที่เลือกตอนสร้างบัญชี HR
create or replace function public.bridge_employer_names(p_secret text)
returns table (employer_name text, certs bigint, last_exam date)
language plpgsql security definer set search_path = public as $$
begin
  perform public.bridge_check(p_secret);
  return query
    select btrim(c.employer_name), count(*)::bigint, max(c.exam_date)
      from public.certificates c
     where c.status is distinct from 'void'
       and c.form_type in ('alien_worker', 'five_disease', 'bilingual')
       and public.bridge_norm(c.employer_name) <> ''
     group by btrim(c.employer_name)
     order by 2 desc
     limit 500;
end; $$;

-- 3) ใบที่มีรหัสอ้างอิงจากเว็บ — roogondee นับเป็นการมาตรวจจริงของคนที่คลิกโฆษณา
--    คืนแค่รหัส + วันที่ ไม่มีชื่อหรือผลตรวจ
create or replace function public.bridge_ref_visits(p_secret text, p_since timestamptz)
returns table (ref_code text, cert_id uuid, form_type text, exam_date date, issued_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  perform public.bridge_check(p_secret);
  return query
    select upper(btrim(c.extra->>'ref_code')), c.id, c.form_type, c.exam_date, c.created_at
      from public.certificates c
     where c.status is distinct from 'void'
       and coalesce(btrim(c.extra->>'ref_code'), '') <> ''
       and c.updated_at >= coalesce(p_since, now() - interval '30 days')
     order by c.updated_at desc
     limit 1000;
end; $$;

revoke all on function public.bridge_employer_certs(text, text[]) from public;
revoke all on function public.bridge_employer_names(text) from public;
revoke all on function public.bridge_ref_visits(text, timestamptz) from public;
grant execute on function public.bridge_employer_certs(text, text[]) to anon;
grant execute on function public.bridge_employer_names(text) to anon;
grant execute on function public.bridge_ref_visits(text, timestamptz) to anon;
