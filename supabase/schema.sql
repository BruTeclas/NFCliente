-- =============================================================================
-- Banco de dados (Supabase): administradores, clientes, perfis e imagens.
-- Pode rodar de novo sem problema (é idempotente).
-- No projeto "NFC Ambiente" ele já foi aplicado como migração.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Administradores
-- -----------------------------------------------------------------------------
create table if not exists public.admins (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now()
);
alter table public.admins enable row level security;

drop policy if exists "admin ve a si mesmo" on public.admins;
create policy "admin ve a si mesmo" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

-- E-mails que viram administradores automaticamente quando a conta é criada
-- e o e-mail está confirmado. Sem políticas: só o SQL Editor mexe aqui.
create table if not exists public.admins_autorizados (
  email     text primary key check (email = lower(email)),
  criado_em timestamptz not null default now()
);
alter table public.admins_autorizados enable row level security;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.promover_admin_autorizado()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  -- Só promove contas criadas pelo painel do Supabase (Add user) ou por convite.
  -- Contas do cadastro público (signUp) recebem confirmation_sent_at e nunca são promovidas,
  -- mesmo que alguém se cadastre antes com um e-mail autorizado.
  if new.email_confirmed_at is not null
     and (new.invited_at is not null or new.confirmation_sent_at is null)
     and exists (
       select 1 from public.admins_autorizados a
       where a.email = lower(new.email) and a.criado_em <= new.created_at
     ) then
    insert into public.admins (user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.promover_admin_autorizado() from public, anon, authenticated;

drop trigger if exists promover_admin_autorizado on auth.users;
create trigger promover_admin_autorizado
  after insert or update of email_confirmed_at, email on auth.users
  for each row execute function public.promover_admin_autorizado();

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
create or replace function public.tocar_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Clientes (dados internos: só administradores leem e escrevem)
-- -----------------------------------------------------------------------------
create table if not exists public.clientes (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (char_length(btrim(nome)) between 1 and 120),
  tipo_pessoa   text not null default 'fisica' check (tipo_pessoa in ('fisica', 'juridica')),
  documento     text check (documento ~ '^([0-9]{11}|[0-9]{14})$'),          -- CPF ou CNPJ, só dígitos
  nascimento    date,
  email         text check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  telefone      text check (telefone ~ '^[0-9]{10,13}$'),                    -- só dígitos, com DDD
  whatsapp      text check (whatsapp ~ '^[0-9]{10,13}$'),
  cep           text check (cep ~ '^[0-9]{8}$'),
  logradouro    text,
  numero        text,
  complemento   text,
  bairro        text,
  cidade        text,
  uf            text check (uf ~ '^[A-Z]{2}$'),
  redes         jsonb not null default '{}'::jsonb check (jsonb_typeof(redes) = 'object'),
  plano         text,
  valor_mensal  numeric(10, 2) check (valor_mensal >= 0),
  observacoes   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists clientes_documento_unico on public.clientes (documento) where documento is not null;
create index if not exists clientes_nome_idx on public.clientes (lower(nome));
alter table public.clientes enable row level security;

drop policy if exists "admin gerencia clientes" on public.clientes;
create policy "admin gerencia clientes" on public.clientes
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop trigger if exists clientes_updated_at on public.clientes;
create trigger clientes_updated_at before update on public.clientes
  for each row execute function public.tocar_updated_at();

-- -----------------------------------------------------------------------------
-- Perfis (a página pública de cada chaveiro)
-- -----------------------------------------------------------------------------
create table if not exists public.perfis (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique
              check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  status      text not null default 'rascunho'
              check (status in ('rascunho', 'ativo', 'inativo')),
  dados       jsonb not null default '{}'::jsonb,                 -- o que aparece na página
  cliente_id  uuid references public.clientes (id) on delete set null,
  vencimento  date,                                             -- uso interno
  observacoes text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.perfis add column if not exists cliente_id uuid references public.clientes (id) on delete set null;
create index if not exists perfis_cliente_idx on public.perfis (cliente_id);
alter table public.perfis enable row level security;

drop policy if exists "admin gerencia perfis" on public.perfis;
create policy "admin gerencia perfis" on public.perfis
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop trigger if exists perfis_updated_at on public.perfis;
create trigger perfis_updated_at before update on public.perfis
  for each row execute function public.tocar_updated_at();

-- Vencimento (v1.1.0): passou do vencimento + 3 dias de carência, no horário de Brasília.
-- Sem vencimento, nunca vence. Mantenha a carência igual a CARENCIA_DIAS em js/db.js.
create or replace function public.perfil_vencido(p_vencimento date)
returns boolean
language sql stable
set search_path = ''
as $$
  select p_vencimento is not null
     and (now() at time zone 'America/Sao_Paulo')::date > p_vencimento + 3;
$$;
revoke all on function public.perfil_vencido(date) from public;
grant execute on function public.perfil_vencido(date) to anon, authenticated;

-- Leitura pública (v1.2.0): só pelo link exato, e só devolve o conteúdo se o perfil estiver
-- no ar e dentro do vencimento. Em qualquer outro caso (inexistente, desativado, vencido,
-- em configuração) devolve nada: não dá para descobrir se um link existe.
-- Visitantes não conseguem listar perfis nem ver dados internos ou de clientes.
create or replace function public.perfil_publico(p_slug text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object('status', 'ativo', 'dados', dados)
  from public.perfis
  where slug = lower(p_slug)
    and status = 'ativo'
    and not public.perfil_vencido(vencimento);
$$;
revoke all on function public.perfil_publico(text) from public;
grant execute on function public.perfil_publico(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Permissões das tabelas (as regras acima decidem quais linhas cada um vê)
-- -----------------------------------------------------------------------------
revoke all on public.admins, public.admins_autorizados, public.clientes, public.perfis from anon;
revoke all on public.admins_autorizados from authenticated;
grant select on public.admins to authenticated;
grant select, insert, update, delete on public.clientes, public.perfis to authenticated;

-- -----------------------------------------------------------------------------
-- Imagens (foto de perfil e de fundo): leitura pública pelo endereço da imagem,
-- envio e exclusão só por administradores.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imagens', 'imagens', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin le imagens" on storage.objects;
create policy "admin le imagens" on storage.objects
  for select to authenticated using (bucket_id = 'imagens' and (select public.is_admin()));

drop policy if exists "admin envia imagens" on storage.objects;
create policy "admin envia imagens" on storage.objects
  for insert to authenticated with check (bucket_id = 'imagens' and (select public.is_admin()));

drop policy if exists "admin altera imagens" on storage.objects;
create policy "admin altera imagens" on storage.objects
  for update to authenticated using (bucket_id = 'imagens' and (select public.is_admin()));

drop policy if exists "admin apaga imagens" on storage.objects;
create policy "admin apaga imagens" on storage.objects
  for delete to authenticated using (bucket_id = 'imagens' and (select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Link de configuração para o cliente (v1.3.0). Desfazer: versoes/v1.3.0-desfazer.sql
-- -----------------------------------------------------------------------------
-- Link de cada perfil (um por perfil; gerar de novo substitui o anterior)
create table if not exists public.links_cliente (
  perfil_id     uuid primary key references public.perfis(id) on delete cascade,
  token_hash    text not null unique,
  criado_em     timestamptz not null default now(),
  revogado_em   timestamptz,
  ultimo_acesso timestamptz,
  erros_pin     int not null default 0,
  bloqueado_ate timestamptz
);
alter table public.links_cliente enable row level security;
create policy "admin ve links do cliente" on public.links_cliente for select to authenticated using ((select public.is_admin()));
revoke all on public.links_cliente from anon, authenticated;
grant select on public.links_cliente to authenticated;

-- Acesso do cliente depois do PIN (vale 2 horas; só as funções abaixo leem esta tabela)
create table if not exists public.sessoes_cliente (
  token_hash text primary key,
  perfil_id  uuid not null references public.perfis(id) on delete cascade,
  link_hash  text not null,
  expira_em  timestamptz not null,
  envios     int not null default 0
);
alter table public.sessoes_cliente enable row level security;
revoke all on public.sessoes_cliente from anon, authenticated;

-- Versão anterior da página a cada alteração (cliente ou administrador)
create table if not exists public.perfis_historico (
  id        bigint generated always as identity primary key,
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  dados     jsonb not null,
  autor     text not null check (autor in ('cliente', 'admin')),
  criado_em timestamptz not null default now()
);
create index if not exists perfis_historico_perfil on public.perfis_historico (perfil_id, criado_em desc);
alter table public.perfis_historico enable row level security;
create policy "admin ve historico" on public.perfis_historico for select to authenticated using ((select public.is_admin()));
revoke all on public.perfis_historico from anon, authenticated;
grant select on public.perfis_historico to authenticated;

create or replace function public.guardar_historico()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.dados is distinct from old.dados then
    insert into public.perfis_historico (perfil_id, dados, autor)
    values (old.id, old.dados, coalesce(nullif(current_setting('nfc.autor', true), ''), 'admin'));
  end if;
  return new;
end; $$;
create trigger perfis_historico after update of dados on public.perfis
  for each row execute function public.guardar_historico();

-- ---------------------------------------------------------------------------
-- Administrador: gerar e revogar o link
-- ---------------------------------------------------------------------------
create or replace function public.gerar_link_cliente(p_perfil_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare p public.perfis; c public.clientes; codigo text;
begin
  if not public.is_admin() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  select * into p from public.perfis where id = p_perfil_id;
  if not found then raise exception 'Perfil não encontrado.'; end if;
  if p.status <> 'ativo' or public.perfil_vencido(p.vencimento) then raise exception 'O perfil precisa estar no ar para gerar o link.'; end if;
  select * into c from public.clientes where id = p.cliente_id;
  if not found then raise exception 'Ligue um cliente a este perfil antes de gerar o link.'; end if;
  if length(regexp_replace(coalesce(c.whatsapp, '') || coalesce(c.telefone, ''), '\D', '', 'g')) < 4 then
    raise exception 'O cadastro do cliente precisa de WhatsApp ou telefone (o PIN são os 4 últimos dígitos).';
  end if;
  codigo := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  insert into public.links_cliente (perfil_id, token_hash) values (p.id, encode(extensions.digest(codigo, 'sha256'), 'hex'))
  on conflict (perfil_id) do update set token_hash = excluded.token_hash, criado_em = now(), revogado_em = null,
    ultimo_acesso = null, erros_pin = 0, bloqueado_ate = null;
  return codigo;
end; $$;

create or replace function public.revogar_link_cliente(p_perfil_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  update public.links_cliente set revogado_em = now() where perfil_id = p_perfil_id and revogado_em is null;
end; $$;

-- ---------------------------------------------------------------------------
-- Cliente: entrar com o PIN, salvar e enviar fotos
-- ---------------------------------------------------------------------------
create or replace function public.cliente_entrar(p_codigo text, p_pin text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare l public.links_cliente; p public.perfis; c public.clientes; h text; sessao text; pin text;
begin
  if p_codigo is null or p_codigo !~ '^[A-Za-z0-9_-]{20,100}$' then return jsonb_build_object('erro', 'link_invalido'); end if;
  h := encode(extensions.digest(p_codigo, 'sha256'), 'hex');
  select * into l from public.links_cliente where token_hash = h for update;
  if not found or l.revogado_em is not null then return jsonb_build_object('erro', 'link_invalido'); end if;
  if l.bloqueado_ate > now() then
    return jsonb_build_object('erro', 'bloqueado', 'minutos', ceil(extract(epoch from l.bloqueado_ate - now()) / 60));
  end if;
  select * into p from public.perfis where id = l.perfil_id;
  select * into c from public.clientes where id = p.cliente_id;
  if p.status <> 'ativo' or public.perfil_vencido(p.vencimento) or c.id is null then return jsonb_build_object('erro', 'indisponivel'); end if;
  pin := coalesce(p_pin, '');
  if pin !~ '^\d{4}$' or pin not in (right(regexp_replace(coalesce(c.whatsapp, ''), '\D', '', 'g'), 4),
                                     right(regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g'), 4)) then
    -- 5 erros seguidos: bloqueia o link por 30 minutos
    update public.links_cliente set
      erros_pin = case when l.erros_pin + 1 >= 5 then 0 else l.erros_pin + 1 end,
      bloqueado_ate = case when l.erros_pin + 1 >= 5 then now() + interval '30 minutes' else null end
    where perfil_id = l.perfil_id;
    if l.erros_pin + 1 >= 5 then return jsonb_build_object('erro', 'bloqueado', 'minutos', 30); end if;
    return jsonb_build_object('erro', 'pin_errado', 'restantes', 4 - l.erros_pin);
  end if;
  sessao := translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/=', '-_');
  insert into public.sessoes_cliente (token_hash, perfil_id, link_hash, expira_em)
  values (encode(extensions.digest(sessao, 'sha256'), 'hex'), p.id, h, now() + interval '2 hours');
  update public.links_cliente set erros_pin = 0, bloqueado_ate = null, ultimo_acesso = now() where perfil_id = p.id;
  return jsonb_build_object('sessao', sessao, 'slug', p.slug, 'dados', p.dados);
end; $$;

-- Perfil da sessão, se ela ainda vale (link não revogado nem trocado, perfil no ar); senão, null
create or replace function public.cliente_perfil_da_sessao(p_sessao text)
returns uuid language sql stable security definer set search_path = '' as $$
  select s.perfil_id
  from public.sessoes_cliente s
  join public.links_cliente l on l.perfil_id = s.perfil_id and l.token_hash = s.link_hash and l.revogado_em is null
  join public.perfis p on p.id = s.perfil_id and p.status = 'ativo' and not public.perfil_vencido(p.vencimento)
  where p_sessao ~ '^[A-Za-z0-9_-]{20,100}$'
    and s.token_hash = encode(extensions.digest(p_sessao, 'sha256'), 'hex')
    and s.expira_em > now();
$$;

-- Confere e limpa o que o cliente enviou. Só estes campos podem mudar; links só dos tipos conhecidos,
-- textos com tamanho limitado, endereços só http(s), fotos só da pasta do próprio perfil.
create or replace function public.dados_do_cliente(p jsonb, p_perfil_id uuid)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare r jsonb := '{}'; links jsonb := '[]'; l jsonb; novo jsonb; k text; v jsonb; i int := 0;
  tipos text[] := array['whatsapp','pix','google_avaliar','maps','google_perfil','email','telefone','site','link','instagram','facebook',
    'tiktok','youtube','linkedin','x','threads','kwai','pinterest','telegram','spotify','twitch','discord','snapchat','behance','github'];
  campos text[] := array['id','tipo','numero','mensagem','chave','nome','cidade','valor','url','email','titulo','subtitulo','icone','usuario','rotulo'];
  pasta text := '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/imagens/' || p_perfil_id::text || '/[A-Za-z0-9._-]+$';
begin
  if jsonb_typeof(p) <> 'object' then raise exception 'Dados inválidos.'; end if;
  r := jsonb_build_object(
    'nome', left(coalesce(p->>'nome', ''), 80),
    'descricao', left(coalesce(p->>'descricao', ''), 300),
    'cor', case when coalesce(p->>'cor', '') ~ '^#[0-9A-Fa-f]{6}$' then p->>'cor' else '#7c3aed' end,
    'tema', case when p->>'tema' = 'claro' then 'claro' else 'escuro' end,
    'mostrarSalvarContato', (p->'mostrarSalvarContato') is distinct from 'false'::jsonb,
    'mostrarCompartilhar', (p->'mostrarCompartilhar') is distinct from 'false'::jsonb);
  foreach k in array array['foto', 'capa'] loop
    if coalesce(p->>k, '') = '' then r := r || jsonb_build_object(k, '');
    elsif (p->>k) ~ pasta then r := r || jsonb_build_object(k, p->>k);
    else raise exception 'Foto inválida. Envie a imagem pela própria página.';
    end if;
  end loop;
  if jsonb_typeof(p->'links') = 'array' then
    if jsonb_array_length(p->'links') > 40 then raise exception 'São permitidos até 40 links.'; end if;
    for l in select * from jsonb_array_elements(p->'links') loop
      i := i + 1;
      if jsonb_typeof(l) <> 'object' or not ((l->>'tipo') = any (tipos)) then raise exception 'Link % inválido.', i; end if;
      novo := '{}';
      for k, v in select * from jsonb_each(l) loop
        continue when not (k = any (campos)) or jsonb_typeof(v) not in ('string', 'number');
        if length(v #>> '{}') > 500 then raise exception 'Texto muito longo no link %.', i; end if;
        if k = 'url' and (v #>> '{}') <> '' and (v #>> '{}') !~* '^(https?://)?[^\s<>"''`]+$' then raise exception 'Endereço inválido no link %.', i; end if;
        if k = 'url' and (v #>> '{}') ~* '^[a-z][a-z0-9+.-]*:' and (v #>> '{}') !~* '^https?://' then raise exception 'Endereço inválido no link %.', i; end if;
        if k = 'icone' and (v #>> '{}') !~ '^fa-(solid|regular|brands) fa-[a-z0-9-]+$' then raise exception 'Ícone inválido no link %.', i; end if;
        novo := novo || jsonb_build_object(k, v #>> '{}');
      end loop;
      links := links || jsonb_build_array(novo);
    end loop;
  end if;
  return r || jsonb_build_object('links', links);
end; $$;

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

-- Usada pela função de envio de fotos: confere a sessão e limita a 30 envios por sessão
create or replace function public.cliente_autorizar_envio(p_sessao text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare pid uuid := public.cliente_perfil_da_sessao(p_sessao);
begin
  if pid is null then return null; end if;
  update public.sessoes_cliente set envios = envios + 1
  where token_hash = encode(extensions.digest(p_sessao, 'sha256'), 'hex') and envios < 30;
  if not found then return null; end if;
  return pid;
end; $$;

revoke all on function public.guardar_historico(), public.gerar_link_cliente(uuid), public.revogar_link_cliente(uuid),
  public.cliente_entrar(text, text), public.cliente_perfil_da_sessao(text), public.dados_do_cliente(jsonb, uuid),
  public.cliente_salvar(text, jsonb), public.cliente_autorizar_envio(text) from public;
grant execute on function public.gerar_link_cliente(uuid), public.revogar_link_cliente(uuid) to authenticated;
grant execute on function public.cliente_entrar(text, text), public.cliente_salvar(text, jsonb) to anon, authenticated;
grant execute on function public.cliente_autorizar_envio(text) to service_role;
-- O Supabase libera toda função nova para anon e authenticated: as internas ficam só para o banco e a função de fotos
revoke execute on function public.guardar_historico(), public.cliente_perfil_da_sessao(text), public.dados_do_cliente(jsonb, uuid),
  public.cliente_autorizar_envio(text) from anon, authenticated;
revoke execute on function public.gerar_link_cliente(uuid), public.revogar_link_cliente(uuid) from anon;

-- -----------------------------------------------------------------------------
-- Teste grátis (v1.5.0). Desfazer: versoes/v1.5.0-desfazer.sql
-- -----------------------------------------------------------------------------
alter table public.perfis add column if not exists teste_desde date;
comment on column public.perfis.teste_desde is 'Dia em que o teste grátis começou (v1.5.0). Vazio: não é teste, ou o cliente foi efetivado.';

-- -----------------------------------------------------------------------------
-- Painel do gestor: segmentos e links/avisos nos painéis dos clientes (v1.7.0). Desfazer: versoes/v1.7.0-desfazer.sql
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Especialidades dentro de cada segmento (v1.7.2). Desfazer: versoes/v1.7.2-desfazer.sql
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Links e avisos na página pública, com regras de saída do ar (v1.7.3). Desfazer: versoes/v1.7.3-desfazer.sql
-- -----------------------------------------------------------------------------
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

-- =============================================================================
-- Quem é administrador: inclua o e-mail aqui ANTES de criar a conta pelo painel
-- (Authentication > Users > Add user ou Invite user). A conta vira administradora
-- sozinha quando o e-mail estiver confirmado. Contas do cadastro público nunca são
-- promovidas. Para uma conta que já existe, confira-a em auth.users e rode a
-- segunda linha.
--
-- insert into public.admins_autorizados (email) values ('email@exemplo.com') on conflict do nothing;
-- insert into public.admins (user_id) select id from auth.users where lower(email) = 'email@exemplo.com' and email_confirmed_at is not null on conflict do nothing;
-- =============================================================================
