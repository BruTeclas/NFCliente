-- Desfaz a v1.7.2: apaga as especialidades e volta as funções do painel do cliente às da v1.7.0.
drop trigger if exists limpar_especialidades on public.perfis;
drop function if exists public.limpar_especialidades();
alter table public.perfis drop column if exists especialidades;
drop table if exists public.especialidades;
-- Depois rode de novo as funções cliente_extras e cliente_salvar de supabase/versoes/v1.7.0.sql
-- (os dois blocos "create or replace function"), para elas deixarem de citar as especialidades.
