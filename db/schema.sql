-- ระบบใบรับรองแพทย์ W Medical — โครงฐานข้อมูล (รันบน Supabase เรียบร้อยแล้ว)

create extension if not exists pgcrypto with schema extensions;
create sequence if not exists public.hn_seq start with 6960000006;

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  hn text not null unique default nextval('public.hn_seq')::text,
  token text not null default encode(extensions.gen_random_bytes(5),'hex'),
  form_type text not null default 'alien_worker',   -- alien_worker | five_disease
  patient_name text not null,
  doc_no text, dob date, age int,
  birth_city text, country text, nationality text, occupation text,
  employer_name text, employer_addr text,
  doctor_name text not null default 'นายแพทย์มานิตย์ จารุวรรณ',
  doctor_license text not null default 'ว.10291',
  exam_date date not null default current_date,
  valid_days int not null default 90,
  height numeric, weight numeric, skin_color text,
  general_condition text default 'ปกติ',
  results jsonb not null default '{}'::jsonb,
  summary text not null default 'healthy',          -- healthy | treat | fail
  summary_diseases text[] not null default '{}',
  other_results text,
  extra jsonb not null default '{}'::jsonb,          -- ฟิลด์เฉพาะแบบฟอร์ม
  status text not null default 'active',             -- active | void
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table if not exists public.cert_audit (
  id bigserial primary key,
  cert_id uuid, hn text, action text not null,
  changed_by uuid, changed_at timestamptz not null default now(),
  old_data jsonb, new_data jsonb
);

alter table public.certificates enable row level security;
alter table public.cert_audit  enable row level security;

create policy staff_all on public.certificates
  for all to authenticated using (true) with check (true);
create policy staff_read_audit on public.cert_audit
  for select to authenticated using (true);

revoke all on public.certificates from anon;
revoke all on public.cert_audit  from anon;

-- หน้าลูกค้าเรียกผ่านฟังก์ชันนี้เท่านั้น: ต้องมี HN คู่กับ token ที่ถูกต้อง
create or replace function public.verify_certificate(p_hn text, p_token text default '')
returns json language sql stable security definer set search_path = public as $$
  select to_json(x) from (
    select c.hn, c.form_type, c.patient_name, c.doc_no, c.dob, c.age,
           c.birth_city, c.country, c.nationality, c.occupation,
           c.employer_name, c.employer_addr, c.doctor_name, c.doctor_license,
           c.exam_date, c.valid_days, c.height, c.weight, c.skin_color,
           c.general_condition, c.results, c.summary, c.summary_diseases,
           c.other_results, c.extra, c.status
    from public.certificates c
    where c.hn = p_hn and c.token = coalesce(p_token,'')
  ) x;
$$;
grant execute on function public.verify_certificate(text,text) to anon, authenticated;

-- ตัวจับเวลาบันทึกผู้สร้าง/แก้ไข + คัดลอกเข้า cert_audit ทุกครั้ง (รันแล้วบน Supabase)
-- create function public.tg_cert_touch() ... / trigger cert_touch_ins/upd/del on certificates

-- =====================================================================
-- อัปเดต (ส.ค. 2569): เลขที่ใบรันอัตโนมัติ, ป้องกันการไล่เดา, ยืนยันข้อมูล,
-- รูปถ่าย, หลายบัญชีเจ้าหน้าที่ — รันบน Supabase เรียบร้อยแล้ว (ดูรายละเอียด
-- แต่ละ migration ใน Supabase Dashboard > Database > Migrations)
-- =====================================================================

-- เลขที่ใบ (HN) รันอัตโนมัติต่อปี พ.ศ. เช่น 6990000040
create table if not exists public.hn_counters (
  year_be int primary key,
  last_no int not null default 0
);
alter table public.hn_counters enable row level security;
create policy staff_read_hn_counters on public.hn_counters for select to authenticated using (true);
revoke all on public.hn_counters from anon;

create or replace function public.next_hn()
returns text language plpgsql security definer set search_path = public as $$
declare v_yr int := (extract(year from current_date)::int + 543) % 100; v_n int;
begin
  insert into public.hn_counters (year_be, last_no) values (v_yr, 1)
  on conflict (year_be) do update set last_no = public.hn_counters.last_no + 1
  returning last_no into v_n;
  return v_yr::text || '9' || lpad(v_n::text, 7, '0');
end; $$;
grant execute on function public.next_hn() to authenticated;
alter table public.certificates alter column hn set default public.next_hn();

-- ยืนยันข้อมูลโดยเจ้าหน้าที่/แพทย์ + รูปถ่ายผู้ตรวจ
alter table public.certificates
  add column if not exists confirmed_by uuid references auth.users(id),
  add column if not exists confirmed_at timestamptz,
  add column if not exists photo_path text;

-- log การเข้าดูหน้าตรวจสอบ (สำหรับ rate limit กันไล่เดาเลข HN)
create table if not exists public.cert_access_log (
  id bigserial primary key,
  cert_id uuid, hn text, ok boolean not null,
  ip text, user_agent text, viewed_at timestamptz not null default now()
);
create index if not exists idx_cert_access_log_ip_ok_viewed on public.cert_access_log (ip, ok, viewed_at);
alter table public.cert_access_log enable row level security;
create policy staff_read_cert_access_log on public.cert_access_log for select to authenticated using (true);
revoke all on public.cert_access_log from anon;

-- ให้หน้า admin แสดงอีเมลเจ้าหน้าที่ผู้ออก/ยืนยันใบ (auth.users ไม่เปิดให้ query ตรง)
create or replace function public.staff_email(p_uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select email from auth.users where id = p_uid;
$$;
grant execute on function public.staff_email(uuid) to authenticated;

create or replace function public.staff_emails(p_uids uuid[])
returns table(id uuid, email text) language sql stable security definer set search_path = public as $$
  select u.id, u.email from auth.users u where u.id = any(p_uids);
$$;
grant execute on function public.staff_emails(uuid[]) to authenticated;

-- Storage bucket สำหรับรูปถ่ายผู้ตรวจ
insert into storage.buckets (id, name, public) values ('cert-photos','cert-photos', true) on conflict (id) do nothing;
create policy "cert-photos public read" on storage.objects for select using (bucket_id = 'cert-photos');
create policy "cert-photos staff write" on storage.objects for insert to authenticated with check (bucket_id = 'cert-photos');
create policy "cert-photos staff update" on storage.objects for update to authenticated using (bucket_id = 'cert-photos');
create policy "cert-photos staff delete" on storage.objects for delete to authenticated using (bucket_id = 'cert-photos');

-- verify_certificate เวอร์ชันจัดเต็ม: rate limit 10 ครั้งผิด/นาทีต่อ IP, บันทึกทุก
-- การเข้าดู, ซ่อน diagnosis/symptoms ของใบลาป่วยด้วยค่า sentinel "__redacted__",
-- คืนสถานะยืนยันข้อมูล + รูปถ่าย
create or replace function public.verify_certificate(p_hn text, p_token text default '')
returns json language plpgsql security definer set search_path = public as $$
declare
  v_ip text := coalesce(nullif(split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for',''), ',', 1), ''), '');
  v_ua text := coalesce(current_setting('request.headers', true)::json->>'user-agent', '');
  v_fail_count int := 0;
  v_cert public.certificates%rowtype;
  v_extra jsonb;
  v_result json;
begin
  if v_ip <> '' then
    select count(*) into v_fail_count from public.cert_access_log
    where ip = v_ip and ok = false and viewed_at > now() - interval '1 minute';
  end if;
  if v_fail_count >= 10 then return null; end if;

  select c.* into v_cert from public.certificates c
  where c.hn = p_hn and c.token = coalesce(p_token, '') limit 1;

  insert into public.cert_access_log (cert_id, hn, ok, ip, user_agent)
  values (v_cert.id, p_hn, v_cert.id is not null, nullif(v_ip, ''), nullif(v_ua, ''));

  if v_cert.id is null then return null; end if;

  v_extra := v_cert.extra;
  if v_cert.form_type = 'sick_leave' then
    if v_extra ? 'diagnosis' then v_extra := jsonb_set(v_extra, '{diagnosis}', '"__redacted__"'); end if;
    if v_extra ? 'symptoms'  then v_extra := jsonb_set(v_extra, '{symptoms}',  '"__redacted__"'); end if;
  end if;

  select to_json(x) into v_result from (
    select v_cert.hn, v_cert.form_type, v_cert.patient_name, v_cert.doc_no, v_cert.dob, v_cert.age,
           v_cert.birth_city, v_cert.country, v_cert.nationality, v_cert.occupation,
           v_cert.employer_name, v_cert.employer_addr, v_cert.doctor_name, v_cert.doctor_license,
           v_cert.exam_date, v_cert.valid_days, v_cert.height, v_cert.weight, v_cert.skin_color,
           v_cert.general_condition, v_cert.results, v_cert.summary, v_cert.summary_diseases,
           v_cert.other_results, v_extra as extra, v_cert.status, v_cert.photo_path,
           (v_cert.confirmed_at is not null) as confirmed, v_cert.confirmed_at,
           public.staff_email(v_cert.confirmed_by) as confirmed_by_email
  ) x;
  return v_result;
end; $$;
grant execute on function public.verify_certificate(text, text) to anon, authenticated;
