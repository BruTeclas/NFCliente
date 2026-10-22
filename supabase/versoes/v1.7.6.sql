-- =============================================================================
-- NFCliente v1.7.6 · Galeria de produtos (carrossel no fim da página do perfil)
-- Rode uma vez no SQL Editor do Supabase. Para desfazer: v1.7.6-desfazer.sql
--
-- O administrador libera a galeria no cadastro do cliente, com o limite de fotos
-- (clientes.galeria_max; 0 = não liberada). As fotos ficam em perfis.dados.galeria:
-- [{ id, foto, legenda, preco }]. Galeria desligada: a página não mostra (as fotos ficam guardadas).
-- =============================================================================

alter table public.clientes add column if not exists galeria_max int not null default 0;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'clientes_galeria_max_valida') then
    alter table public.clientes add constraint clientes_galeria_max_valida check (galeria_max between 0 and 20);
  end if;
end $$;

-- Confere a galeria enviada pelo cliente: até p_max fotos, só da pasta do próprio perfil,
-- legenda até 60 letras e preço até 20.
create or replace function public.galeria_do_cliente(p jsonb, p_perfil_id uuid, p_max int)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare item jsonb; r jsonb := '[]'::jsonb; n int := 0;
  pasta text := '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/imagens/' || p_perfil_id::text || '/[A-Za-z0-9._-]+$';
begin
  if p is null or jsonb_typeof(p) <> 'array' then raise exception 'Galeria inválida.'; end if;
  if jsonb_array_length(p) > p_max then raise exception 'A galeria aceita no máximo % fotos.', p_max; end if;
  for item in select value from jsonb_array_elements(p) loop
    if jsonb_typeof(item) <> 'object' or coalesce(item->>'foto', '') !~ pasta then
      raise exception 'Foto da galeria inválida. Envie a imagem pela própria página.';
    end if;
    n := n + 1;
    r := r || jsonb_build_array(jsonb_build_object(
      'id', left(coalesce(nullif(regexp_replace(coalesce(item->>'id', ''), '[^A-Za-z0-9_-]', '', 'g'), ''), 'g' || n), 20),
      'foto', item->>'foto',
      'legenda', left(btrim(coalesce(item->>'legenda', '')), 60),
      'preco', left(btrim(coalesce(item->>'preco', '')), 20)));
  end loop;
  return r;
end; $$;
revoke all on function public.galeria_do_cliente(jsonb, uuid, int) from public, anon, authenticated;

-- Página pública (v1.7.3) + galeria só se liberada, até o limite do cliente
create or replace function public.perfil_publico(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('status', 'ativo',
    'dados', case
      when coalesce(c.galeria_max, 0) > 0 and jsonb_typeof(p.dados->'galeria') = 'array' then
        jsonb_set(p.dados, '{galeria}', coalesce((
          select jsonb_agg(x.value order by x.ordinality)
          from jsonb_array_elements(p.dados->'galeria') with ordinality x
          where x.ordinality <= c.galeria_max), '[]'::jsonb))
      else p.dados - 'galeria' end,
    'avisos', public.avisos_do_perfil(p.id, 'pagina'))
  from public.perfis p
  left join public.clientes c on c.id = p.cliente_id
  where p.slug = lower(p_slug)
    and p.status = 'ativo'
    and not public.perfil_vencido(p.vencimento);
$$;

-- Painel do cliente (v1.7.3) + limite da galeria
create or replace function public.cliente_extras(p_sessao text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare pid uuid; seg uuid; esp uuid[]; gmax int;
begin
  pid := public.cliente_perfil_da_sessao(p_sessao);
  if pid is null then return jsonb_build_object('erro', 'sessao'); end if;
  select pf.segmento_id, pf.especialidades, coalesce(c.galeria_max, 0) into seg, esp, gmax
  from public.perfis pf left join public.clientes c on c.id = pf.cliente_id where pf.id = pid;
  return jsonb_build_object(
    'segmento_id', seg,
    'minhas_especialidades', to_jsonb(coalesce(esp, '{}')),
    'galeria_max', gmax,
    'segmentos', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome) order by s.nome) from public.segmentos s), '[]'::jsonb),
    'especialidades', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'segmento_id', e.segmento_id, 'nome', e.nome) order by e.nome) from public.especialidades e), '[]'::jsonb),
    'avisos', public.avisos_do_perfil(pid, 'painel'));
end; $$;

-- Salvar do cliente (v1.7.2) + galeria (só se liberada; o limite vem do cadastro do cliente)
create or replace function public.cliente_salvar(p_sessao text, p_dados jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pid uuid; novos jsonb; seg uuid; seg_txt text; esp uuid[]; gmax int;
begin
  pid := public.cliente_perfil_da_sessao(p_sessao);
  if pid is null then return jsonb_build_object('erro', 'sessao'); end if;
  novos := public.dados_do_cliente(p_dados, pid);
  if jsonb_typeof(p_dados) = 'object' and p_dados ? 'galeria' then
    select coalesce(c.galeria_max, 0) into gmax from public.perfis pf left join public.clientes c on c.id = pf.cliente_id where pf.id = pid;
    if gmax > 0 then novos := novos || jsonb_build_object('galeria', public.galeria_do_cliente(p_dados->'galeria', pid, gmax)); end if;
  end if;
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
