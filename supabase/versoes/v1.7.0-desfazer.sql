-- Desfaz a v1.7.0: apaga segmentos, links/avisos dos painéis e o segmento dos perfis,
-- e volta o salvar do cliente ao da v1.3.0.
drop function if exists public.cliente_extras(text);
create or replace function public.cliente_salvar(p_sessao text, p_dados jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pid uuid; novos jsonb;
begin
  pid := public.cliente_perfil_da_sessao(p_sessao);
  if pid is null then return jsonb_build_object('erro', 'sessao'); end if;
  novos := public.dados_do_cliente(p_dados, pid);
  perform set_config('nfc.autor', 'cliente', true);
  update public.perfis set dados = coalesce(dados, '{}') || novos where id = pid returning dados into novos;
  perform set_config('nfc.autor', '', true);
  return jsonb_build_object('ok', true, 'dados', novos);
end; $$;
drop table if exists public.avisos_clientes;
alter table public.perfis drop column if exists segmento_id;
drop table if exists public.segmentos;
