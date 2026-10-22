/*
 * Leitura pública de um perfil (nfcliente.com.br/<link>).
 *
 * Esta página não carrega a biblioteca de login do Supabase: faz uma única consulta
 * à função public.perfil_publico, que só devolve o conteúdo de perfis no ar.
 * Desativado, vencido, em configuração ou inexistente: a resposta é sempre a mesma (nada).
 */
(function () {
  "use strict";
  var cfg = window.CONFIG || {};
  var configurado = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);

  function urlBase() { return (cfg.dominio || location.origin).replace(/\/+$/, ""); }

  // Login antigo do painel, de quando ele ficava neste mesmo endereço: não deve ficar guardado aqui.
  function limparSessaoAntiga() {
    try {
      if (!cfg.dominio || location.hostname !== new URL(cfg.dominio).hostname) return;
      Object.keys(localStorage).forEach(function (k) { if (/^sb-.+-auth-token/.test(k)) localStorage.removeItem(k); });
    } catch (e) { /* armazenamento bloqueado: nada a limpar */ }
  }

  // Modo demonstração (sem Supabase): lê os perfis que o painel de demonstração guardou neste navegador,
  // com a mesma regra do banco (no ar e sem vencimento passado da carência de 3 dias).
  function hojeBrasilia() {
    try { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  }
  function vencido(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})(?!\d)/.exec(String(v == null ? "" : v));
    if (!m) return false;
    var d = new Date(0); d.setUTCFullYear(+m[1], +m[2] - 1, +m[3] + 3);   // vencimento + 3 dias de carência
    var limite = String(d.getUTCFullYear()).padStart(4, "0") + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
    return hojeBrasilia() > limite;
  }
  function semDadosDemo() { try { return !localStorage.getItem("bt_demo_perfis"); } catch (e) { return true; } }
  function lerDemo(k, padrao) { try { return JSON.parse(localStorage.getItem(k)) || padrao; } catch (e) { return padrao; } }
  // Links e avisos do administrador para a página (mesmas regras do banco, sem a contagem por aparelho)
  function avisosDemo(p) {
    var agora = Date.now(), cliques = lerDemo("bt_demo_cliques", {});
    var cli = lerDemo("bt_demo_clientes", []).filter(function (c) { return c && c.id === p.cliente_id; })[0];
    if (cli && cli.sem_divulgacao) return [];
    return lerDemo("bt_demo_avisos", []).filter(function (a) {
      if (!a || !a.ativo || (a.onde !== "pagina" && a.onde !== "ambos")) return false;
      if (a.inicio && new Date(a.inicio).getTime() > agora) return false;
      if (a.fim && new Date(a.fim).getTime() <= agora) return false;
      if (a.max_cliques_total && (a.cliques_total || 0) >= a.max_cliques_total) return false;
      if (a.max_cliques_perfil && ((cliques[a.id] || {})[p.id] || 0) >= a.max_cliques_perfil) return false;
      if (a.alvo === "segmentos") return (a.segmentos || []).indexOf(p.segmento_id) >= 0 &&
        (!(a.especialidades || []).length || a.especialidades.some(function (e) { return (p.especialidades || []).indexOf(e) >= 0; }));
      if (a.alvo === "perfis") return (a.perfis || []).indexOf(p.id) >= 0;
      return true;
    }).map(function (a) { return { id: a.id, tipo: a.tipo, titulo: a.titulo, texto: a.texto, url: a.url, icone: a.icone, patrocinado: a.patrocinado }; });
  }
  function perfilDemo(slug) {
    var lista = lerDemo("bt_demo_perfis", []);
    var p = (Array.isArray(lista) ? lista : []).filter(function (x) { return x && x.slug === slug; })[0];
    if (!(p && p.status === "ativo" && !vencido(p.vencimento))) return null;
    // Galeria só se liberada no cadastro do cliente, até o limite
    var cli = lerDemo("bt_demo_clientes", []).filter(function (c) { return c && c.id === p.cliente_id; })[0];
    var dados = Object.assign({}, p.dados || {}), max = (cli && cli.galeria_max) || 0;
    if (max > 0 && Array.isArray(dados.galeria)) dados.galeria = dados.galeria.slice(0, max); else delete dados.galeria;
    return { dados: dados, avisos: avisosDemo(p) };
  }
  function cliqueDemo(avisoId, slug) {
    var p = lerDemo("bt_demo_perfis", []).filter(function (x) { return x && x.slug === slug; })[0];
    if (!p) return;
    var c = lerDemo("bt_demo_cliques", {}), avisos = lerDemo("bt_demo_avisos", []);
    c[avisoId] = c[avisoId] || {};
    c[avisoId][p.id] = (c[avisoId][p.id] || 0) + 1;
    avisos.forEach(function (a) { if (a.id === avisoId) a.cliques_total = (a.cliques_total || 0) + 1; });
    try { localStorage.setItem("bt_demo_cliques", JSON.stringify(c)); localStorage.setItem("bt_demo_avisos", JSON.stringify(avisos)); } catch (e) { /* demonstração */ }
  }

  // Devolve { dados, avisos } do perfil no ar, ou null. Falha de rede: promessa rejeitada.
  function perfil(slug) {
    slug = String(slug || "").toLowerCase();
    if (!configurado) return Promise.resolve(perfilDemo(slug));
    // Mesmos cabeçalhos que a biblioteca oficial envia sem login: a chave pública (publishable)
    return fetch(cfg.supabaseUrl.replace(/\/+$/, "") + "/rest/v1/rpc/perfil_publico", {
      method: "POST",
      headers: { "apikey": cfg.supabaseAnonKey, "Authorization": "Bearer " + cfg.supabaseAnonKey, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ p_slug: slug }),
      credentials: "omit",
      referrerPolicy: "no-referrer"
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (j) {
      // Só conteúdo de perfil no ar; qualquer outra resposta (inclusive de versões antigas do banco) = indisponível
      if (!(j && j.status === "ativo" && j.dados && typeof j.dados === "object")) return null;
      return { dados: j.dados, avisos: Array.isArray(j.avisos) ? j.avisos : [] };
    });
  }

  // Clique num link do administrador (conta para as regras de saída do ar). Nunca atrapalha a página.
  function registrarClique(avisoId, slug) {
    if (!avisoId) return;
    if (!configurado) return cliqueDemo(avisoId, String(slug || "").toLowerCase());
    try {
      fetch(cfg.supabaseUrl.replace(/\/+$/, "") + "/rest/v1/rpc/registrar_clique_aviso", {
        method: "POST", keepalive: true, credentials: "omit", referrerPolicy: "no-referrer",
        headers: { "apikey": cfg.supabaseAnonKey, "Authorization": "Bearer " + cfg.supabaseAnonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ p_aviso: avisoId, p_slug: String(slug || "").toLowerCase() })
      }).catch(function () { /* sem contagem, sem problema */ });
    } catch (e) { /* idem */ }
  }

  limparSessaoAntiga();
  window.Publico = {
    perfil: perfil, registrarClique: registrarClique, urlPerfil: function (slug) { return urlBase() + "/" + slug; }, demo: !configurado,
    // Modo demonstração sem nenhum perfil guardado neste navegador (o painel de demonstração cria os exemplos)
    semDadosDemo: function () { return !configurado && semDadosDemo(); }
  };
})();
