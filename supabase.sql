-- SIGMO v0.2 - estrutura inicial
-- Execute no Supabase SQL Editor se ainda não tiver executado.

create table if not exists public.sigmo_users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nome text not null,
  re text unique not null,
  graduacao text,
  pelotao text,
  email text,
  telefone text,
  perfil text not null default 'Policial',
  situacao text not null default 'Aguardando Aprovação',
  pin text not null,
  criado_por text
);

create table if not exists public.sigmo_audit (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  action text not null,
  description text,
  actor_id uuid,
  actor_name text,
  actor_profile text,
  module text,
  severity text default 'Informativo'
);

alter table public.sigmo_users enable row level security;
alter table public.sigmo_audit enable row level security;

drop policy if exists sigmo_users_select on public.sigmo_users;
drop policy if exists sigmo_users_insert on public.sigmo_users;
drop policy if exists sigmo_audit_select on public.sigmo_audit;
drop policy if exists sigmo_audit_insert on public.sigmo_audit;

create policy sigmo_users_select on public.sigmo_users for select using (true);
create policy sigmo_users_insert on public.sigmo_users for insert with check (true);
create policy sigmo_audit_select on public.sigmo_audit for select using (true);
create policy sigmo_audit_insert on public.sigmo_audit for insert with check (true);

insert into public.sigmo_users (nome, re, graduacao, pelotao, perfil, situacao, pin, criado_por)
values ('Administrador SIGMO', 'admin', 'Administrador', 'Intermediária', 'Comandante da Companhia', 'Ativo', '123456', 'Sistema')
on conflict (re) do nothing;
