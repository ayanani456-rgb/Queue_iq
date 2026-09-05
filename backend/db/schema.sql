-- =============================================================================
-- QueueIQ — schema migration (ADDITIVE, non-destructive)
-- =============================================================================
-- Extends the existing team DB (organizations, appointments, tokens, feedbacks)
-- to support the backend we built. Everything uses "IF NOT EXISTS" / "ADD COLUMN
-- IF NOT EXISTS" so it will NOT drop or overwrite existing tables or data.
--
-- Review before running. Apply in Supabase → SQL Editor (or via migration).
-- =============================================================================

-- 1) organizations: add business type + service pace ---------------------------
alter table public.organizations
  add column if not exists type text not null default 'clinic'
    check (type in ('clinic','bank','salon','lab','government')),
  add column if not exists avg_service_minutes int not null default 8;

-- 2) doctors (new) -------------------------------------------------------------
create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  specialty text,
  fee int,
  created_at timestamptz not null default now()
);

-- 3) patients / abuse tracking (new) ------------------------------------------
create table if not exists public.patients (
  phone text primary key,
  false_claim_count int not null default 0,
  emergency_suspended boolean not null default false,
  created_at timestamptz not null default now()
);

-- 4) tokens: add the columns our backend uses ---------------------------------
alter table public.tokens
  add column if not exists token_number text,
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists doctor_id uuid references public.doctors(id) on delete set null,
  add column if not exists phone text,
  add column if not exists status text not null default 'Waiting'
    check (status in ('Waiting','Serving','Done','Skipped','PendingApproval','Rejected','Cancelled')),
  add column if not exists position int,
  add column if not exists slot_time text,
  -- emergency triage (nullable — only set for emergency tokens)
  add column if not exists emergency_type text,
  add column if not exists description text,
  add column if not exists urgency_score numeric,
  add column if not exists recommendation text,
  add column if not exists matched_signals jsonb,
  add column if not exists triage_source text;

create index if not exists idx_tokens_org_status   on public.tokens (organization_id, status);
create index if not exists idx_tokens_org_position on public.tokens (organization_id, position);

-- 5) helper: hand out the next token number (T-101, T-102, …) ------------------
create sequence if not exists public.token_seq start 101;
create or replace function public.next_token_number()
returns text language sql as $$
  select 'T-' || nextval('public.token_seq')
$$;

-- 6) helper: shift positions +1 from a point (the express/emergency insert) -----
-- Supabase's JS update can't do "position = position + 1" directly, so we do it
-- in one atomic SQL statement here and call it via rpc('shift_positions').
create or replace function public.shift_positions(p_org uuid, p_from int)
returns void language sql as $$
  update public.tokens
     set position = position + 1
   where organization_id = p_org
     and status in ('Waiting','Serving')
     and position >= p_from;
$$;

-- 7) helper: atomic false-claim increment (avoids a read-then-write race) -------
create or replace function public.record_false_claim(p_phone text, p_limit int)
returns int language plpgsql as $$
declare new_count int;
begin
  insert into public.patients (phone, false_claim_count, emergency_suspended)
  values (p_phone, 1, (1 >= p_limit))
  on conflict (phone) do update
    set false_claim_count = public.patients.false_claim_count + 1,
        emergency_suspended = (public.patients.false_claim_count + 1) >= p_limit
  returning false_claim_count into new_count;
  return new_count;
end;
$$;

-- NOTE (security): Row Level Security is currently DISABLED on these tables.
-- Enable it + add policies before production (see the RLS note we discussed).
