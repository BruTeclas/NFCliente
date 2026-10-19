-- =============================================================================
-- NFCliente v1.7.0 · Painel do gestor: segmentos e links/avisos nos painéis dos clientes
-- Rode uma vez no SQL Editor do Supabase. Para desfazer: v1.7.0-desfazer.sql
--
-- Segmentos: lista mantida só pelo administrador; cada perfil pode ter um. O cliente escolhe
-- o do próprio perfil pelo painel dele, só entre os da lista.
-- Links e avisos: criados só pelo administrador e mostrados no painel do cliente (todos,
-- alguns segmentos ou alguns perfis). A página pública não muda.
-- =============================================================================

create table if not exists public.segmentos (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null check (char_length(btrim(nome)) between 1 and 60),
  criado_em timestamptz not null default now()
);
create unique index if not exists segmentos_nome_unico on public.segmentos (lower(btrim(nome)));
alter table public.segmentos enable row level security;

alter table public.perfis add column if not exists segmento_id uuid references public.segmentos(id) on delete set null;
create index if not exists perfis_segmento on public.perfis (segmento_id);

create table if not exists public.avisos_clientes (
  id        uuid primary key default gen_random_uuid(),
  tipo      text not null default 'link' check (tipo in ('link', 'aviso')),
  titulo    text not null check (char_length(btrim(titulo)) between 1 and 60),
  texto     text check (char_length(texto) <= 300),
  url       text check (url is null or url ~* '^(https://\S+|mailto:\S+|tel:[+0-9][0-9 -]*)$'),
  icone     text check (icone is null or icone ~ '^fa-(solid|brands|regular) fa-[a-z0-9-]+$'),
  alvo      text not null default 'todos' check (alvo in ('todos', 'segmentos', 'perfis')),
  segmentos uuid[] not null default '{}',
  perfis    uuid[] not null default '{}',
  ativo     boolean not null default true,
  ordem     int not null default 0,
  criado_em timestamptz not null default now(),
  check (tipo = 'aviso' or url is not null)
);
alter table public.avisos_clientes enable row level security;

-- Só administradores leem e alteram (pelo painel)
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'segmentos' and policyname = 'admin gerencia segmentos') then
    create policy "admin gerencia segmentos" on public.segmentos for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'avisos_clientes' and policyname = 'admin gerencia avisos') then
    create policy "admin gerencia avisos" on public.avisos_clientes for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;
revoke all on public.segmentos, public.avisos_clientes from anon;
grant select, insert, update, delete on public.segmentos, public.avisos_clientes to authenticated;

-- Painel do cliente: segmento atual, lista de segmentos e os links/avisos que valem para este perfil
create or replace function public.cliente_extras(p_sessao text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare pid uuid; seg uuid;
begin
  pid := public.cliente_perfil_da_sessao(p_sessao);
  if pid is null then return jsonb_build_object('erro', 'sessao'); end if;
  select segmento_id into seg from public.perfis where id = pid;
  return jsonb_build_object(
    'segmento_id', seg,
    'segmentos', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome) order by s.nome) from public.segmentos s), '[]'::jsonb),
    'avisos', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', a.tipo, 'titulo', a.titulo, 'texto', a.texto, 'url', a.url, 'icone', a.icone) order by a.ordem, a.criado_em)
      from public.avisos_clientes a
      where a.ativo and (a.alvo = 'todos' or (a.alvo = 'segmentos' and seg = any(a.segmentos)) or (a.alvo = 'perfis' and pid = any(a.perfis)))
    ), '[]'::jsonb));
end; $$;

-- Salvar do cliente (v1.3.0) + segmento: "_segmento_id" em p_dados escolhe um dos segmentos da lista ("" tira)
create or replace function public.cliente_salvar(p_sessao text, p_dados jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pid uuid; novos jsonb; seg uuid; seg_txt text;
begin
  pid := public.cliente_perfil_da_sessao(p_sessao);
  if pid is null then return jsonb_build_object('erro', 'sessao'); end if;
  novos := public.dados_do_cliente(p_dados, pid);
  if jsonb_typeof(p_dados) = 'object' and p_dados ? '_segmento_id' then
    seg_txt := nullif(p_dados->>'_segmento_id', '');
    if seg_txt is not null then
      if seg_txt !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Segmento inválido.'; end if;
      select id into seg from public.segmentos where id = seg_txt::uuid;
      if seg is null then raise exception 'Segmento inválido. Recarregue a página e escolha de novo.'; end if;
    end if;
    update public.perfis set segmento_id = seg where id = pid;
  end if;
  perform set_config('nfc.autor', 'cliente', true);
  update public.perfis set dados = coalesce(dados, '{}') || novos where id = pid returning dados, segmento_id into novos, seg;
  perform set_config('nfc.autor', '', true);
  return jsonb_build_object('ok', true, 'dados', novos, 'segmento_id', seg);
end; $$;

revoke all on function public.cliente_extras(text) from public;
grant execute on function public.cliente_extras(text) to anon, authenticated;
