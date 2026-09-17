-- =====================================================================
-- ผลแล็บตรวจสอบได้: ข้อมูลห้องปฏิบัติการ + ไทม์ไลน์การตรวจ + รหัสผนึกผล
-- (lab provenance / examination timeline / tamper-evident seal)
--
-- สถานะ: ยังไม่ได้รันบน Supabase — ให้รันไฟล์นี้ใน SQL Editor ก่อน deploy หน้าเว็บ
-- ปลอดภัยกับข้อมูลเดิม: เป็นการ "เพิ่ม" ทั้งหมด ไม่มีการลบ/แก้ข้อมูลใบเก่า
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) คอลัมน์ใหม่บนตาราง certificates
-- ---------------------------------------------------------------------
alter table public.certificates
  add column if not exists lab jsonb not null default '{}'::jsonb,
  add column if not exists lab_verified_by uuid references auth.users(id),
  add column if not exists lab_verified_at timestamptz,
  add column if not exists seal text,
  add column if not exists sealed_at timestamptz;

comment on column public.certificates.lab is
  'ข้อมูลกำกับผลแล็บ: lab_no, xray_no, registered_at, collected_at, reported_at, mt_name, mt_license, methods{}';

-- ---------------------------------------------------------------------
-- 2) เลข Lab No. รันอัตโนมัติต่อปี พ.ศ. — เช่น L69-000123
--    (แล็บในโรงพยาบาลเอง จึงออกเลขจากระบบนี้ได้เลย ไม่ต้องพิมพ์มือ)
-- ---------------------------------------------------------------------
create table if not exists public.lab_counters (
  year_be int primary key,
  last_no int not null default 0
);
alter table public.lab_counters enable row level security;
drop policy if exists staff_read_lab_counters on public.lab_counters;
create policy staff_read_lab_counters on public.lab_counters
  for select to authenticated using (true);
revoke all on public.lab_counters from anon;
grant select on public.lab_counters to authenticated;

create or replace function public.next_lab_no()
returns text language plpgsql security definer set search_path = public as $$
declare v_yr int := (extract(year from current_date)::int + 543) % 100; v_n int;
begin
  insert into public.lab_counters (year_be, last_no) values (v_yr, 1)
  on conflict (year_be) do update set last_no = public.lab_counters.last_no + 1
  returning last_no into v_n;
  return 'L' || v_yr::text || '-' || lpad(v_n::text, 6, '0');
end; $$;
grant execute on function public.next_lab_no() to authenticated;

-- ---------------------------------------------------------------------
-- 3) ลูกโซ่รหัสผนึกผล (append-only)
--    ทุกครั้งที่ผนึก จะคำนวณ sha256 ของ "ผลตรวจ + ข้อมูลแล็บ + รหัสผนึกของใบก่อนหน้า"
--    ใครแก้ผลตรวจย้อนหลังในฐานข้อมูล รหัสจะคำนวณใหม่ไม่ตรงทันที
-- ---------------------------------------------------------------------
create table if not exists public.cert_seal (
  id bigserial primary key,
  cert_id uuid not null references public.certificates(id) on delete restrict,
  hn text not null,
  seal text not null,
  prev_seal text,
  sealed_by uuid references auth.users(id),
  sealed_at timestamptz not null default now()
);
create index if not exists idx_cert_seal_cert on public.cert_seal (cert_id, id desc);
alter table public.cert_seal enable row level security;
drop policy if exists staff_read_cert_seal on public.cert_seal;
create policy staff_read_cert_seal on public.cert_seal
  for select to authenticated using (true);
-- ไม่มี policy insert/update/delete โดยเจตนา: เขียนได้ผ่านฟังก์ชัน seal_certificate เท่านั้น
revoke all on public.cert_seal from anon;
grant select on public.cert_seal to authenticated;
revoke insert, update, delete on public.cert_seal from authenticated;

-- ข้อมูลที่ถูกผนึก (ต้องคำนวณซ้ำได้เหมือนเดิมทุกครั้ง — jsonb เรียงคีย์ให้เองอยู่แล้ว)
create or replace function public.cert_payload(c public.certificates)
returns text language sql immutable set search_path = public as $$
  select (jsonb_build_object(
    'hn',       c.hn,
    'doc_no',   coalesce(c.doc_no, ''),
    'name',     c.patient_name,
    'exam',     c.exam_date::text,
    'results',  c.results,
    'summary',  c.summary,
    'dis',      to_jsonb(c.summary_diseases),
    'other',    coalesce(c.other_results, ''),
    'lab',      c.lab,
    'doctor',   c.doctor_name || '|' || c.doctor_license
  ))::text;
$$;

create or replace function public.seal_certificate(p_id uuid)
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  v_c public.certificates%rowtype;
  v_prev text;
  v_seal text;
  v_n int;
begin
  select * into v_c from public.certificates where id = p_id;
  if v_c.id is null then
    raise exception 'ไม่พบใบรับรองฉบับนี้';
  end if;
  if v_c.lab_verified_at is null then
    raise exception 'ยังไม่มีนักเทคนิคการแพทย์รับรองผลแล็บ';
  end if;
  if v_c.confirmed_at is null then
    raise exception 'ยังไม่มีแพทย์รับรองผล';
  end if;

  select seal into v_prev from public.cert_seal order by id desc limit 1;
  v_seal := upper(encode(
    extensions.digest(coalesce(v_prev, 'GENESIS') || '|' || public.cert_payload(v_c), 'sha256'), 'hex'));

  insert into public.cert_seal (cert_id, hn, seal, prev_seal, sealed_by)
  values (p_id, v_c.hn, v_seal, v_prev, auth.uid());

  update public.certificates
     set seal = v_seal, sealed_at = now()
   where id = p_id;

  select count(*) into v_n from public.cert_seal where cert_id = p_id;
  return json_build_object('seal', v_seal, 'short', left(v_seal, 10), 'revision', v_n);
end; $$;
grant execute on function public.seal_certificate(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4) แก้ผลตรวจเมื่อไหร่ การรับรองหลุดทันที
--    ถ้ามีการแก้ผลตรวจ/ข้อมูลแล็บ/ตัวตนผู้ตรวจ หลังรับรองไปแล้ว
--    ระบบจะล้างการรับรองของ ทนพ. + แพทย์ และล้างรหัสผนึก
--    → ต้องให้ ทนพ. และแพทย์รับรองใหม่ ผนึกใหม่ (cert_seal เก็บของเดิมไว้ทุกครั้ง)
-- ---------------------------------------------------------------------
create or replace function public.tg_cert_unseal()
returns trigger language plpgsql as $$
begin
  if (new.results       is distinct from old.results)
  or (new.lab           is distinct from old.lab)
  or (new.summary       is distinct from old.summary)
  or (new.summary_diseases is distinct from old.summary_diseases)
  or (new.other_results is distinct from old.other_results)
  or (new.exam_date     is distinct from old.exam_date)
  or (new.patient_name  is distinct from old.patient_name)
  or (new.doc_no        is distinct from old.doc_no)
  or (new.doctor_name   is distinct from old.doctor_name)
  or (new.doctor_license is distinct from old.doctor_license)
  then
    -- ยอมให้ผ่านเฉพาะกรณีที่คำสั่งเดียวกันตั้งใจรับรองใหม่อยู่แล้ว
    if new.confirmed_at is not distinct from old.confirmed_at then
      new.confirmed_at := null; new.confirmed_by := null;
    end if;
    if new.lab_verified_at is not distinct from old.lab_verified_at then
      new.lab_verified_at := null; new.lab_verified_by := null;
    end if;
    new.seal := null; new.sealed_at := null;
  end if;
  return new;
end; $$;

-- ชื่อขึ้นต้น cert_a_ เพื่อให้ทำงานก่อน cert_touch_upd (postgres เรียง trigger ตามชื่อ)
-- cert_audit จะได้บันทึกสถานะหลังล้างการรับรองแล้ว ไม่ใช่ก่อน
drop trigger if exists cert_unseal on public.certificates;
drop trigger if exists cert_a_unseal on public.certificates;
create trigger cert_a_unseal before update on public.certificates
  for each row execute function public.tg_cert_unseal();

-- ---------------------------------------------------------------------
-- 5) (ทางเลือก — ยังไม่เปิดใช้) บังคับให้ ทนพ. และแพทย์เป็นคนละบัญชี
--    เปิดใช้เมื่อเปิดบัญชีให้นักเทคนิคการแพทย์แยกจากบัญชีแพทย์แล้ว
--    วิธีเปิด: ลบเครื่องหมาย -- ข้างหน้าทุกบรรทัดในบล็อกนี้ แล้วรันใหม่
-- ---------------------------------------------------------------------
-- alter table public.certificates
--   add constraint cert_dual_control check (
--     lab_verified_by is null or confirmed_by is null or lab_verified_by <> confirmed_by
--   );

-- ---------------------------------------------------------------------
-- 6) verify_certificate — ต่อยอดจากตัวที่ใช้งานอยู่จริง
--    เพิ่ม: ข้อมูลแล็บ, ผู้รับรองผลแล็บ, รหัสผนึก + ผลตรวจสอบว่ารหัสยังตรงอยู่ไหม
--    คงไว้ทั้งหมด: rate limit 10 ครั้งผิด/นาที, โหมด preview, ซ่อนอาการใบลาป่วย
--    เอาออก: อีเมลเจ้าหน้าที่ (ไม่ควรโชว์บนหน้าสาธารณะ) — แสดงชื่อวิชาชีพแทน
-- ---------------------------------------------------------------------
create or replace function public.verify_certificate(p_hn text, p_token text default '')
returns json language plpgsql security definer set search_path = public, extensions as $$
declare
  v_ip text := coalesce(nullif(split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for',''), ',', 1), ''), '');
  v_ua text := coalesce(current_setting('request.headers', true)::json->>'user-agent', '');
  v_fail_count int := 0;
  v_cert public.certificates%rowtype;
  v_extra jsonb;
  v_seal public.cert_seal%rowtype;
  v_seal_ok boolean := false;
  v_rev int := 0;
  v_result json;
begin
  if v_ip <> '' then
    select count(*) into v_fail_count
    from public.cert_access_log
    where ip = v_ip and ok = false and viewed_at > now() - interval '1 minute';
  end if;

  if v_fail_count >= 10 then
    return null;
  end if;

  -- ระดับ 2: เลขที่ + รหัสลับตรงกัน → ใบเต็ม
  select c.* into v_cert
  from public.certificates c
  where c.hn = p_hn and c.token = coalesce(p_token, '')
  limit 1;

  if v_cert.id is null then
    -- ระดับ 1: เจอเลขที่แต่รหัสลับไม่ตรง/ไม่มี → ผลยืนยันขั้นต้น (ไม่มีข้อมูลส่วนบุคคล)
    select c.* into v_cert
    from public.certificates c
    where c.hn = p_hn
    limit 1;

    insert into public.cert_access_log (cert_id, hn, ok, ip, user_agent)
    values (v_cert.id, p_hn, v_cert.id is not null, nullif(v_ip, ''), nullif(v_ua, ''));

    if v_cert.id is null then
      return null;
    end if;

    select to_json(x) into v_result from (
      select true as preview,
             v_cert.hn, v_cert.form_type, v_cert.exam_date, v_cert.valid_days, v_cert.status,
             (v_cert.confirmed_at is not null) as confirmed,
             v_cert.confirmed_at,
             (v_cert.lab_verified_at is not null) as lab_verified,
             (v_cert.seal is not null) as sealed,
             v_cert.sealed_at
    ) x;
    return v_result;
  end if;

  insert into public.cert_access_log (cert_id, hn, ok, ip, user_agent)
  values (v_cert.id, p_hn, true, nullif(v_ip, ''), nullif(v_ua, ''));

  v_extra := v_cert.extra;
  if v_cert.form_type = 'sick_leave' then
    if v_extra ? 'diagnosis' then v_extra := jsonb_set(v_extra, '{diagnosis}', '"__redacted__"'); end if;
    if v_extra ? 'symptoms'  then v_extra := jsonb_set(v_extra, '{symptoms}',  '"__redacted__"'); end if;
  end if;

  -- ตรวจว่ารหัสผนึกยังตรงกับข้อมูลปัจจุบันหรือไม่ (คำนวณใหม่ทุกครั้งที่มีคนเปิดดู)
  select * into v_seal from public.cert_seal where cert_id = v_cert.id order by id desc limit 1;
  if v_seal.id is not null then
    select count(*) into v_rev from public.cert_seal where cert_id = v_cert.id;
    v_seal_ok := (v_seal.seal = upper(encode(
      extensions.digest(coalesce(v_seal.prev_seal, 'GENESIS') || '|' || public.cert_payload(v_cert), 'sha256'), 'hex')))
      and (v_cert.seal = v_seal.seal);
  end if;

  select to_json(x) into v_result from (
    select v_cert.hn, v_cert.form_type, v_cert.patient_name, v_cert.doc_no, v_cert.dob, v_cert.age,
           v_cert.birth_city, v_cert.country, v_cert.nationality, v_cert.occupation,
           v_cert.employer_name, v_cert.employer_addr, v_cert.doctor_name, v_cert.doctor_license,
           v_cert.exam_date, v_cert.valid_days, v_cert.height, v_cert.weight, v_cert.skin_color,
           v_cert.general_condition, v_cert.results, v_cert.summary, v_cert.summary_diseases,
           v_cert.other_results, v_extra as extra,
           v_cert.status, v_cert.photo_path,
           (v_cert.confirmed_at is not null) as confirmed,
           v_cert.confirmed_at,
           v_cert.lab as lab,
           v_cert.lab_verified_at,
           (v_cert.lab_verified_at is not null) as lab_verified,
           v_cert.seal, v_cert.sealed_at,
           v_seal_ok as seal_ok,
           v_rev as seal_revision
  ) x;

  return v_result;
end; $$;
grant execute on function public.verify_certificate(text, text) to anon, authenticated;
