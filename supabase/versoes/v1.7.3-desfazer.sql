-- Desfaz a v1.7.3: links e avisos voltam a aparecer só no painel do cliente, sem regras de saída.
-- 1) Rode de novo perfil_publico de supabase/schema.sql (bloco "Leitura pública (v1.2.0)")
--    e cliente_extras de supabase/versoes/v1.7.2.sql.
-- 2) Depois apague o que a v1.7.3 criou:
drop function if exists public.registrar_clique_aviso(uuid, text);
drop function if exists public.avisos_do_perfil(uuid, text);
drop table if exists public.avisos_cliques_recentes;
drop table if exists public.avisos_cliques;
alter table public.clientes drop column if exists sem_divulgacao;
alter table public.avisos_clientes drop constraint if exists avisos_regras_validas, drop constraint if exists avisos_onde_valido,
  drop column if exists onde, drop column if exists patrocinado, drop column if exists especialidades, drop column if exists inicio,
  drop column if exists fim, drop column if exists max_cliques_perfil, drop column if exists max_cliques_total, drop column if exists cliques_total;
