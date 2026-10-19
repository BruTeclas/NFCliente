-- =============================================================================
-- NFCliente v1.7.2 · Especialidades (micro segmentos) dentro de cada segmento
-- Rode uma vez no SQL Editor do Supabase. Para desfazer: v1.7.2-desfazer.sql
--
-- Cada segmento (macro) tem a sua lista de especialidades, mantida só pelo administrador.
-- Cada perfil tem um segmento e várias especialidades desse segmento. O próprio banco descarta
-- especialidades de outro segmento (ou excluídas) sempre que o perfil é gravado.
-- =============================================================================

create table if not exists public.especialidades (
  id          uuid primary key default gen_random_uuid(),
  segmento_id uuid not null references public.segmentos(id) on delete cascade,
  nome        text not null check (char_length(btrim(nome)) between 1 and 60),
  criado_em   timestamptz not null default now()
);
create unique index if not exists especialidades_nome_unico on public.especialidades (segmento_id, lower(btrim(nome)));
alter table public.especialidades enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'especialidades' and policyname = 'admin gerencia especialidades') then
    create policy "admin gerencia especialidades" on public.especialidades for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;
revoke all on public.especialidades from anon;
grant select, insert, update, delete on public.especialidades to authenticated;

alter table public.perfis add column if not exists especialidades uuid[] not null default '{}';

-- Só especialidades existentes e do segmento do perfil; sem segmento, nenhuma
create or replace function public.limpar_especialidades()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.segmento_id is null then
    new.especialidades := '{}';
  elsif coalesce(cardinality(new.especialidades), 0) > 0 then
    new.especialidades := coalesce(array(
      select e.id from public.especialidades e
      where e.id = any(new.especialidades) and e.segmento_id = new.segmento_id
      order by e.nome), '{}');
  end if;
  return new;
end; $$;
create or replace trigger limpar_especialidades before insert or update of segmento_id, especialidades on public.perfis
  for each row execute function public.limpar_especialidades();
revoke all on function public.limpar_especialidades() from public, anon, authenticated;

-- Painel do cliente: v1.7.0 + lista de especialidades e as marcadas no perfil
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
    'avisos', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', a.tipo, 'titulo', a.titulo, 'texto', a.texto, 'url', a.url, 'icone', a.icone) order by a.ordem, a.criado_em)
      from public.avisos_clientes a
      where a.ativo and (a.alvo = 'todos' or (a.alvo = 'segmentos' and seg = any(a.segmentos)) or (a.alvo = 'perfis' and pid = any(a.perfis)))
    ), '[]'::jsonb));
end; $$;

-- Salvar do cliente: v1.7.0 + "_especialidades" (lista de ids; o gatilho descarta as que não valem)
create or replace function public.cliente_salvar(p_sessao text, p_dados jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pid uuid; novos jsonb; seg uuid; seg_txt text; esp uuid[];
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
  if jsonb_typeof(p_dados) = 'object' and jsonb_typeof(p_dados->'_especialidades') = 'array' then
    if jsonb_array_length(p_dados->'_especialidades') > 50 then raise exception 'Especialidades demais.'; end if;
    select coalesce(array_agg(x::uuid), '{}') into esp
    from jsonb_array_elements_text(p_dados->'_especialidades') x
    where x ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    update public.perfis set especialidades = esp where id = pid;
  end if;
  perform set_config('nfc.autor', 'cliente', true);
  update public.perfis set dados = coalesce(dados, '{}') || novos where id = pid returning dados, segmento_id, especialidades into novos, seg, esp;
  perform set_config('nfc.autor', '', true);
  return jsonb_build_object('ok', true, 'dados', novos, 'segmento_id', seg, 'especialidades', to_jsonb(esp));
end; $$;
