-- =============================================================================
-- NFCliente v1.7.3 · Links e avisos também na página pública, com regras de saída do ar
-- Rode uma vez no SQL Editor do Supabase. Para desfazer: v1.7.3-desfazer.sql
--
-- Onde aparece: painel do cliente, página do perfil (visitantes) ou os dois.
-- Sai do ar na primeira regra atingida: data/hora de fim, máximo de cliques por perfil
-- ou no total. Pode ter data de início (agendado). Cliques do mesmo aparelho contam uma vez
-- por hora; do aparelho, o banco guarda só um código embaralhado (nunca o endereço).
-- O cliente pode ficar sem divulgação na página dele (clientes.sem_divulgacao).
-- =============================================================================

alter table public.avisos_clientes
  add column if not exists onde text not null default 'painel',
  add column if not exists patrocinado boolean not null default false,
  add column if not exists especialidades uuid[] not null default '{}',
  add column if not exists inicio timestamptz,
  add column if not exists fim timestamptz,
  add column if not exists max_cliques_perfil int,
  add column if not exists max_cliques_total int,
  add column if not exists cliques_total int not null default 0;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'avisos_onde_valido') then
    alter table public.avisos_clientes add constraint avisos_onde_valido check (onde in ('painel', 'pagina', 'ambos'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'avisos_regras_validas') then
    alter table public.avisos_clientes add constraint avisos_regras_validas check (
      (max_cliques_perfil is null or max_cliques_perfil > 0) and (max_cliques_total is null or max_cliques_total > 0)
      and (inicio is null or fim is null or fim > inicio));
  end if;
end $$;

alter table public.clientes add column if not exists sem_divulgacao boolean not null default false;

-- Cliques por aviso e perfil (o painel lê; só o banco grava)
create table if not exists public.avisos_cliques (
  aviso_id  uuid not null references public.avisos_clientes(id) on delete cascade,
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  cliques   int not null default 0,
  primary key (aviso_id, perfil_id)
);
alter table public.avisos_cliques enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'avisos_cliques' and policyname = 'admin le cliques') then
    create policy "admin le cliques" on public.avisos_cliques for select to authenticated using (public.is_admin());
  end if;
end $$;
revoke all on public.avisos_cliques from anon, authenticated;
grant select on public.avisos_cliques to authenticated;

-- Último clique contado por aparelho (código embaralhado), para contar no máximo um por hora
create table if not exists public.avisos_cliques_recentes (
  aviso_id  uuid not null references public.avisos_clientes(id) on delete cascade,
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  origem    text not null,
  quando    timestamptz not null default now(),
  primary key (aviso_id, perfil_id, origem)
);
alter table public.avisos_cliques_recentes enable row level security;
revoke all on public.avisos_cliques_recentes from anon, authenticated;

-- Links e avisos que valem agora para um perfil, no painel do cliente ('painel') ou na página ('pagina')
create or replace function public.avisos_do_perfil(p_pid uuid, p_onde text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'tipo', a.tipo, 'titulo', a.titulo, 'texto', a.texto, 'url', a.url,
    'icone', a.icone, 'patrocinado', a.patrocinado) order by a.ordem, a.criado_em), '[]'::jsonb)
  from public.avisos_clientes a
  join public.perfis p on p.id = p_pid
  left join public.clientes c on c.id = p.cliente_id
  left join public.avisos_cliques k on k.aviso_id = a.id and k.perfil_id = p.id
  where a.ativo
    and (a.onde = 'ambos' or a.onde = p_onde)
    and not (p_onde = 'pagina' and coalesce(c.sem_divulgacao, false))
    and (a.inicio is null or a.inicio <= now())
    and (a.fim is null or a.fim > now())
    and (a.max_cliques_total is null or a.cliques_total < a.max_cliques_total)
    and (a.max_cliques_perfil is null or coalesce(k.cliques, 0) < a.max_cliques_perfil)
    and (a.alvo = 'todos'
      or (a.alvo = 'segmentos' and p.segmento_id = any(a.segmentos)
          and (cardinality(a.especialidades) = 0 or a.especialidades && p.especialidades))
      or (a.alvo = 'perfis' and p.id = any(a.perfis)));
$$;
revoke all on function public.avisos_do_perfil(uuid, text) from public, anon, authenticated;

-- Página pública (v1.2.0) + os links e avisos da página
create or replace function public.perfil_publico(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('status', 'ativo', 'dados', dados, 'avisos', public.avisos_do_perfil(id, 'pagina'))
  from public.perfis
  where slug = lower(p_slug)
    and status = 'ativo'
    and not public.perfil_vencido(vencimento);
$$;

-- Painel do cliente (v1.7.2) com as mesmas regras de exibição
create or replace function public.cliente_extras(p_sessao text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare pid uuid; seg uuid; esp uuid[];
begin
  pid := public.cliente_perfil_da_sessao(p_sessao);
  if pid is null then return jsonb_build_object('erro', 'sessao'); end if;
  select segmento_id, especialidades into seg, esp from public.perfis where id = pid;
  return jsonb_build_object(
    'segmento_id', seg,
    'minhas_especialidades', to_jsonb(coalesce(esp, '{}')),
    'segmentos', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome) order by s.nome) from public.segmentos s), '[]'::jsonb),
    'especialidades', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'segmento_id', e.segmento_id, 'nome', e.nome) order by e.nome) from public.especialidades e), '[]'::jsonb),
    'avisos', public.avisos_do_perfil(pid, 'painel'));
end; $$;

-- Clique num link (página pública ou painel do cliente): conta se o link ainda vale para o perfil
create or replace function public.registrar_clique_aviso(p_aviso uuid, p_slug text)
returns void language plpgsql security definer set search_path = '' as $$
declare pid uuid; hdr json; ip text; contou int;
begin
  if p_aviso is null or p_slug is null then return; end if;
  select id into pid from public.perfis where slug = lower(p_slug) and status = 'ativo' and not public.perfil_vencido(vencimento);
  if pid is null then return; end if;
  if not exists (
    select 1 from jsonb_array_elements(public.avisos_do_perfil(pid, 'pagina') || public.avisos_do_perfil(pid, 'painel')) x
    where x->>'id' = p_aviso::text and x->>'tipo' = 'link'
  ) then return; end if;
  begin hdr := nullif(current_setting('request.headers', true), '')::json; exception when others then hdr := null; end;
  ip := btrim(coalesce(hdr->>'cf-connecting-ip', hdr->>'x-real-ip', split_part(coalesce(hdr->>'x-forwarded-for', ''), ',', 1), ''));
  insert into public.avisos_cliques_recentes (aviso_id, perfil_id, origem)
  values (p_aviso, pid, encode(extensions.digest(ip || ':' || p_aviso::text, 'sha256'), 'hex'))
  on conflict (aviso_id, perfil_id, origem) do update set quando = now()
    where public.avisos_cliques_recentes.quando < now() - interval '1 hour';
  get diagnostics contou = row_count;
  if contou = 0 then return; end if;   -- mesmo aparelho há menos de 1 hora
  insert into public.avisos_cliques (aviso_id, perfil_id, cliques) values (p_aviso, pid, 1)
  on conflict (aviso_id, perfil_id) do update set cliques = public.avisos_cliques.cliques + 1;
  update public.avisos_clientes set cliques_total = cliques_total + 1 where id = p_aviso;
end; $$;
revoke all on function public.registrar_clique_aviso(uuid, text) from public;
grant execute on function public.registrar_clique_aviso(uuid, text) to anon, authenticated;
