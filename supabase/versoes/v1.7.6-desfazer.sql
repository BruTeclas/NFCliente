-- Desfaz a v1.7.6: some a galeria da página e do painel do cliente.
-- 1) Rode de novo perfil_publico e cliente_extras de supabase/versoes/v1.7.3.sql
--    e cliente_salvar de supabase/versoes/v1.7.2.sql.
-- 2) Depois:
drop function if exists public.galeria_do_cliente(jsonb, uuid, int);
alter table public.clientes drop constraint if exists clientes_galeria_max_valida, drop column if exists galeria_max;
-- As fotos continuam em perfis.dados.galeria (não aparecem em lugar nenhum). Para apagá-las:
-- update public.perfis set dados = dados - 'galeria' where dados ? 'galeria';
