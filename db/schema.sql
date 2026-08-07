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
