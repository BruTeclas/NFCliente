/* Painel administrativo: login (com recuperação e troca de senha), perfis (lista, editor,
   ativar/desativar/excluir) e clientes (cadastro completo, ligado aos perfis). */
(function () {
  "use strict";

  var el = Perfil.el, icone = Perfil.icone, TIPOS = Perfil.TIPOS;
  var $ = function (id) { return document.getElementById(id); };
  var cfg = window.CONFIG || {};

  var estado = {
    perfis: [],
    segmentos: [],      // painel do gestor (v1.7.0)
    especialidades: [], // dentro de cada segmento (v1.7.2)
    filtroEsp: [],      // especialidades marcadas no filtro da lista (qualquer uma delas)
    avisos: [],
    filtroSeg: "",      // "" todos · "sem" sem segmento · id
    filtro: "todos",
    busca: "",
    ed: null,           // editor de perfil: { orig, p, sujo, imagensNovas: [] }
    cl: null,           // cadastro de cliente: { id, c, orig, rota, sujo }
    clientes: [],
    buscaClientes: ""
  };

  var TEXTO_STATUS = {
    ativo: ["No ar", "O cliente e qualquer pessoa que ler o chaveiro veem a página."],
    inativo: ["Desativado", "Fora do ar. Quem acessar vê \"Perfil temporariamente indisponível\". Nada foi apagado."],
    rascunho: ["Em configuração", "Ainda não liberado. Quem acessar vê \"Em breve\"."],
    vencido: ["Fora do ar · vencido", "O vencimento passou há mais de " + DB.CARENCIA_DIAS + " dias e a página saiu do ar sozinha. Quem acessar vê \"Perfil temporariamente indisponível\". Nada foi apagado. Renove o vencimento e ela volta na hora."],
    teste: ["Em teste", "Teste grátis: a página está no ar e sai sozinha no fim do teste. Se o cliente fechar, clique em \"Efetivar\"."],
    "nao-fechou": ["Teste não fechou", "O teste acabou sem o cliente fechar, e a página está fora do ar. Nada foi apagado. Se ele fechar depois, clique em \"Efetivar\"."]
  };

  // ===========================================================================
  // Utilitários
  // ===========================================================================
  function clonar(o) { return JSON.parse(JSON.stringify(o)); }
  function toast(msg, ehErro) {
    var t = $("toastAdmin");
    t.textContent = msg;
    t.className = "toast-admin ver" + (ehErro ? " erro-t" : "");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.className = "toast-admin"; }, ehErro ? 5000 : 2600);
  }
  function falhou(e) {
    console.error(e);
    toast(e && e.amigavel ? e.message : "Algo deu errado: " + (e && e.message || e), true);
  }
  function dataBR(iso) { if (!iso) return ""; var p = String(iso).slice(0, 10).split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }
  // Venceu (em carência ou já fora do ar). Fora do ar por vencimento: DB.foraPorVencimento(p)
  function vencido(p) { var s = DB.situacaoVencimento(p.vencimento).situacao; return s === "carencia" || s === "fora"; }
  function statusVisivel(p) {
    var t = DB.situacaoTeste(p);
    if (t) return t.situacao;   // "teste" ou "nao-fechou"
    return DB.foraPorVencimento(p) ? "vencido" : p.status;
  }
  function nomeDe(p) { return (p.dados && p.dados.nome) || (p.cliente && p.cliente.nome) || p.slug; }
  function selo(status) { return el("span", { class: "selo " + status, text: TEXTO_STATUS[status][0] }); }
  function seloPerfil(p) { return selo(statusVisivel(p)); }
  // Texto do vencimento na lista e no editor
  function textoVencimento(p) {
    var t = DB.situacaoTeste(p);
    if (t) return t.situacao === "teste" ? { classe: "vence-logo", texto: " Teste até " + dataBR(t.ate) }
      : { classe: "vencido", texto: p.status === "ativo" ? " Teste terminou em " + dataBR(t.ate) : " Teste encerrado" };
    var v = DB.situacaoVencimento(p.vencimento);
    if (v.situacao === "sem") return null;
    if (v.situacao === "fora") return { classe: "vencido", texto: " Venceu " + dataBR(v.vencimento) + (p.status === "ativo" ? " · fora do ar desde " + dataBR(v.saiDoAr) : "") };
    if (v.situacao === "carencia") return { classe: "carencia", texto: " Venceu " + dataBR(v.vencimento) + (p.status === "ativo" ? " · sai do ar em " + dataBR(v.saiDoAr) : "") };
    if (v.situacao === "vence-logo") return { classe: "vence-logo", texto: " Vence " + dataBR(v.vencimento) + (v.dias === 0 ? " (hoje)" : v.dias === 1 ? " (amanhã)" : " (em " + v.dias + " dias)") };
    return { classe: null, texto: " Vence " + dataBR(v.vencimento) };
  }
  function uid() { return Math.random().toString(36).slice(2, 10); }

  var campoTexto = EditorPerfil.campoTexto;

  // ---------------------------------------------------------------------------
  // Modais
  // ---------------------------------------------------------------------------
  function abrirModal(filhos, aoFechar) {
    var fundo = el("div", { class: "modal-fundo" });
    var caixa = el("div", { class: "modal", role: "dialog", "aria-modal": "true" }, filhos);
    fundo.appendChild(caixa);
    function fechar() { fundo.remove(); document.removeEventListener("keydown", esc); if (aoFechar) aoFechar(); }
    function esc(e) { if (e.key === "Escape") fechar(); }
    fundo.addEventListener("mousedown", function (e) { if (e.target === fundo) fechar(); });
    document.addEventListener("keydown", esc);
    $("modais").appendChild(fundo);
    var foco = caixa.querySelector("input, button.primario, button.perigo, button.verde");
    if (foco) setTimeout(function () { foco.focus(); }, 30);
    return { fechar: fechar, caixa: caixa };
  }

  // opcoes: { titulo, texto, botao, classe, exigir (texto que precisa ser digitado), alerta }
  function confirmar(o) {
    return new Promise(function (ok) {
      var resolvido = false, m;
      var digitado = o.exigir ? el("input", { type: "text", placeholder: o.exigir, autocomplete: "off" }) : null;
      var btnOk = el("button", { class: "btn " + (o.classe || "primario"), type: "button", text: o.botao || "Confirmar" });
      if (digitado) {
        btnOk.disabled = true;
        digitado.addEventListener("input", function () { btnOk.disabled = digitado.value.trim().toLowerCase() !== o.exigir; });
        digitado.addEventListener("keydown", function (e) { if (e.key === "Enter" && !btnOk.disabled) btnOk.click(); });
      }
      btnOk.addEventListener("click", function () { resolvido = true; m.fechar(); ok(true); });
      m = abrirModal([
        el("h2", { text: o.titulo }),
        el("p", { text: o.texto }),
        o.alerta ? el("div", { class: "alerta" }, [icone("fa-solid fa-triangle-exclamation"), " ", o.alerta]) : null,
        digitado ? el("label", {}, ["Para confirmar, digite ", el("code", { text: o.exigir }), digitado]) : null,
        el("div", { class: "modal-botoes" }, [
          el("button", { class: "btn", type: "button", text: "Cancelar", onclick: function () { m.fechar(); } }),
          btnOk
        ])
      ], function () { if (!resolvido) ok(false); });
    });
  }

  function mostrarQR(p) {
    var url = DB.urlPerfil(p.slug);
    var caixa = el("div", { class: "qr-caixa" });
    var m = abrirModal([
      el("h2", { text: "QR Code do perfil" }),
      el("p", { text: "Imprima no verso do chaveiro ou na embalagem, para quem estiver com o NFC desligado." }),
      caixa,
      el("div", { class: "qr-link", text: url }),
      el("div", { class: "modal-botoes" }, [
        el("button", { class: "btn", type: "button", onclick: function () { Perfil.copiar(url, "Link copiado!"); } }, [icone("fa-regular fa-copy"), " Copiar link"]),
        el("button", { class: "btn primario", type: "button", onclick: function () {
          var c = caixa.querySelector("canvas");
          var a = el("a", { href: c ? c.toDataURL("image/png") : caixa.querySelector("img").src, download: "qrcode-" + p.slug + ".png" });
          document.body.appendChild(a); a.click(); a.remove();
        } }, [icone("fa-solid fa-download"), " Baixar PNG"]),
        el("button", { class: "btn fantasma", type: "button", text: "Fechar", onclick: function () { m.fechar(); } })
      ])
    ]);
    if (window.QRCode) new QRCode(caixa, { text: url, width: 1024, height: 1024, correctLevel: QRCode.CorrectLevel.M });
    else caixa.textContent = "Não foi possível carregar o gerador de QR Code.";
  }

  // ===========================================================================
  // Ações de status (usadas na lista e no editor)
  // ===========================================================================
  function mudarStatus(p, novo) {
    var c;
    if (novo === "ativo" && p.status === "rascunho") {
      if (!(p.dados && p.dados.nome)) { toast("Preencha pelo menos o nome exibido antes de liberar.", true); return Promise.resolve(null); }
      c = { titulo: "Liberar perfil para o cliente?", texto: "A página " + DB.urlPerfil(p.slug) + " passa a funcionar para qualquer pessoa.", botao: "Liberar", classe: "verde" };
    } else if (novo === "ativo") {
      c = { titulo: "Reativar perfil?", texto: "A página volta ao ar imediatamente com todos os links.", botao: "Reativar", classe: "verde" };
    } else {
      c = { titulo: "Desativar perfil?", texto: "A página sai do ar na hora. Quem ler o chaveiro verá \"Perfil temporariamente indisponível\". Nenhum dado é apagado; dá para reativar quando quiser.", botao: "Desativar", classe: "perigo" };
    }
    var vencidoFora = novo === "ativo" && DB.situacaoVencimento(p.vencimento).situacao === "fora";
    if (vencidoFora) c.alerta = "O vencimento (" + dataBR(DB.dataISO(p.vencimento)) + ") já passou da carência. Mesmo liberado, a página continua fora do ar até você renovar.";
    return confirmar(c).then(function (sim) {
      if (!sim) return null;
      return DB.salvar(p.id, { status: novo }).then(function (r) {
        toast(novo !== "ativo" ? "Perfil desativado." : vencidoFora ? "Pronto, mas a página continua fora do ar por vencimento. Use \"Renovar +1 mês\"." : "Perfil no ar! ✅");
        return r;
      });
    }).catch(function (e) { falhou(e); return null; });
  }

  // Renova o vencimento por 1 mês, contando do vencimento anterior (ou de hoje, se não havia)
  function renovar(p) {
    if (p.teste_desde) return efetivar(p);   // em teste, renovar é efetivar
    var atual = DB.dataISO(p.vencimento);
    var base = atual && +atual.slice(0, 4) >= 2000 ? atual : DB.hojeBrasilia();   // data absurda: conta a partir de hoje
    var novo = DB.somarMes(base);
    var volta = DB.foraPorVencimento(p) && DB.situacaoVencimento(novo).situacao !== "fora";
    var aindaFora = p.status === "ativo" && DB.situacaoVencimento(novo).situacao === "fora";
    return confirmar({
      titulo: "Renovar até " + dataBR(novo) + "?",
      texto: "O próximo vencimento passa de " + (atual ? dataBR(atual) : "(sem data)") + " para " + dataBR(novo) + "." +
        (volta ? " A página volta ao ar na hora." : "") +
        (aindaFora ? " Atenção: essa data ainda passou da carência, então a página continua fora do ar. Renove de novo ou ajuste a data no perfil." : ""),
      botao: "Renovar", classe: "verde"
    }).then(function (sim) {
      if (!sim) return null;
      return DB.salvar(p.id, { vencimento: novo }).then(function (r) {
        toast("Renovado até " + dataBR(novo) + (volta ? ". Perfil de volta no ar! ✅" : "."));
        return r;
      });
    }).catch(function (e) { falhou(e); return null; });
  }

  // Teste grátis: no ar hoje e mais CARENCIA_DIAS dias; depois sai sozinho (pelo vencimento automático)
  function liberarTeste(p) {
    if (!(p.dados && p.dados.nome)) { toast("Preencha pelo menos o nome exibido antes de liberar.", true); return Promise.resolve(null); }
    var hoje = DB.hojeBrasilia(), ate = DB.situacaoTeste({ status: "ativo", vencimento: hoje, teste_desde: hoje }).ate;
    return confirmar({
      titulo: "Liberar teste de " + DB.CARENCIA_DIAS + " dias?",
      texto: "A página " + DB.urlPerfil(p.slug) + " fica no ar até " + dataBR(ate) + " e depois sai do ar sozinha. Se o cliente fechar, clique em \"Efetivar\". Durante o teste, você já pode gerar o link para ele editar o perfil.",
      botao: "Liberar teste", classe: "verde"
    }).then(function (sim) {
      if (!sim) return null;
      return DB.salvar(p.id, { status: "ativo", vencimento: hoje, teste_desde: hoje }).then(function (r) {
        toast("Teste liberado até " + dataBR(ate) + "! ✅");
        return r;
      });
    }).catch(function (e) { falhou(e); return null; });
  }
  // O cliente fechou: sai do teste, fica no ar e vence daqui a 1 mês
  function efetivar(p) {
    var novo = DB.somarMes(DB.hojeBrasilia());
    return confirmar({
      titulo: "Efetivar o cliente?",
      texto: "O teste vira assinatura: a página fica no ar e o próximo vencimento passa a ser " + dataBR(novo) + ".",
      botao: "Efetivar", classe: "verde"
    }).then(function (sim) {
      if (!sim) return null;
      return DB.salvar(p.id, { status: "ativo", vencimento: novo, teste_desde: null }).then(function (r) {
        toast("Cliente efetivado! Vence em " + dataBR(novo) + ". ✅");
        return r;
      });
    }).catch(function (e) { falhou(e); return null; });
  }

  function excluirPerfil(p) {
    return confirmar({
      titulo: "Excluir perfil permanentemente?",
      texto: "Apaga a página \"" + nomeDe(p) + "\", todos os links e as fotos. O cadastro do cliente continua.",
      alerta: "Não dá para desfazer. Se for só falta de pagamento, use \"Desativar\".",
      exigir: p.slug, botao: "Excluir para sempre", classe: "perigo"
    }).then(function (sim) {
      if (!sim) return false;
      return DB.excluir(p.id).then(function () { toast("Perfil excluído."); return true; });
    }).catch(function (e) { falhou(e); return false; });
  }

  // ===========================================================================
  // Login / sessão
  // ===========================================================================
  function mostrarLogin() {
    $("telaApp").hidden = true;
    $("telaLogin").hidden = false;
    mostrarFormLogin(location.hash === "#esqueci");
    if (DB.demo) $("loginErro").textContent = "Modo demonstração: digite qualquer e-mail e senha.";
    if (DB.indisponivel) $("loginErro").textContent = DB.indisponivel;
  }
  function mostrarFormLogin(recuperar) {
    $("formLogin").hidden = !!recuperar;
    $("formRecuperar").hidden = !recuperar;
    if (recuperar) {
      if (!$("recuperarEmail").value) $("recuperarEmail").value = $("loginEmail").value;
      $("recuperarErro").textContent = "";
      $("recuperarEmail").focus();
    } else $("loginEmail").focus();
  }
  $("btnEsqueci").addEventListener("click", function () { mostrarFormLogin(true); });
  $("btnVoltarLogin").addEventListener("click", function () { if (location.hash === "#esqueci") history.replaceState(null, "", "#/"); mostrarFormLogin(false); });
  $("formRecuperar").addEventListener("submit", function (e) {
    e.preventDefault();
    var btn = this.querySelector("button[type=submit]");
    btn.disabled = true;
    $("recuperarErro").textContent = "";
    $("recuperarOk").hidden = true;
    DB.recuperarSenha($("recuperarEmail").value).then(function () {
      $("recuperarOk").textContent = DB.demo
        ? "Modo demonstração: nenhum e-mail é enviado."
        : "Se este e-mail tiver acesso ao painel, você vai receber um link em instantes. Confira também a caixa de spam.";
      $("recuperarOk").hidden = false;
      // Evita pedidos repetidos em sequência
      var resta = 60, txt = btn.innerHTML;
      btn.textContent = "Aguarde " + resta + "s";
      var t = setInterval(function () {
        resta--;
        if (resta <= 0) { clearInterval(t); btn.innerHTML = txt; btn.disabled = false; }
        else btn.textContent = "Aguarde " + resta + "s";
      }, 1000);
    }).catch(function (err) {
      $("recuperarErro").textContent = err.amigavel ? err.message : "Não foi possível enviar agora. Tente novamente.";
      btn.disabled = false;
    });
  });
  $("formLogin").addEventListener("submit", function (e) {
    e.preventDefault();
    var btn = e.submitter || this.querySelector("button");
    btn.disabled = true;
    $("loginErro").textContent = "";
    DB.entrar($("loginEmail").value.trim(), $("loginSenha").value).then(function (u) {
      $("loginSenha").value = "";
      entrarNoApp(u);
    }).catch(function (err) {
      $("loginErro").textContent = err.amigavel ? err.message : "Não foi possível entrar.";
    }).then(function () { btn.disabled = false; });
  });
  function haAlteracoes() { return !!((estado.ed && estado.ed.sujo) || (estado.cl && estado.cl.sujo)); }
  function descartarTudo() { descartarEdicao(); estado.cl = null; }
  function confirmarDescarte() {
    if (!haAlteracoes()) return Promise.resolve(true);
    return confirmar({ titulo: "Descartar alterações?", texto: "Há alterações que ainda não foram salvas.", botao: "Descartar", classe: "perigo" });
  }
  $("btnSair").addEventListener("click", function () {
    confirmarDescarte().then(function (sim) {
      if (!sim) return;
      descartarTudo();
      DB.sair().then(function () { history.replaceState(null, "", "#/"); mostrarLogin(); });
    });
  });

  function entrarNoApp(usuario) {
    $("telaLogin").hidden = true;
    $("telaApp").hidden = false;
    $("usuarioEmail").textContent = usuario && usuario.email || "";
    if (location.hash === "#esqueci") history.replaceState(null, "", "#/");
    rota();
  }

  // ---------------------------------------------------------------------------
  // Minha conta: trocar a senha (confere a senha atual)
  // ---------------------------------------------------------------------------
  $("btnConta").addEventListener("click", function () {
    var atual = el("input", { type: "password", autocomplete: "current-password" });
    var nova = el("input", { type: "password", autocomplete: "new-password" });
    var conf = el("input", { type: "password", autocomplete: "new-password" });
    var erroEl = el("p", { class: "erro", role: "alert" });
    var regras = el("ul", { class: "regras-senha" });
    function checar() {
      var v = nova.value;
      regras.innerHTML = "";
      [[v.length >= 8, "Pelo menos 8 caracteres"], [/[A-Za-z]/.test(v) && /\d/.test(v), "Letras e números"],
       [v && v === conf.value, "As duas senhas iguais"]].forEach(function (r) {
        regras.appendChild(el("li", { class: r[0] ? "ok" : null }, [icone(r[0] ? "fa-solid fa-circle-check" : "fa-regular fa-circle"), " " + r[1]]));
      });
    }
    nova.addEventListener("input", checar); conf.addEventListener("input", checar); checar();
    var btn = el("button", { class: "btn primario", type: "submit" }, [icone("fa-solid fa-key"), " Trocar senha"]);
    var form = el("form", {}, [
      el("h2", { text: "Minha conta" }),
      el("p", { text: "Conectado como " + ($("usuarioEmail").textContent || "administrador") + "." }),
      el("label", {}, ["Senha atual", atual]),
      el("label", {}, ["Nova senha", nova]),
      el("label", {}, ["Repita a nova senha", conf]),
      regras, erroEl,
      el("p", { class: "dica", text: "Ao trocar, os outros aparelhos conectados com esta conta são desconectados." }),
      el("div", { class: "modal-botoes" }, [el("button", { class: "btn", type: "button", text: "Fechar", onclick: function () { m.fechar(); } }), btn])
    ]);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      erroEl.textContent = "";
      if (nova.value !== conf.value) { erroEl.textContent = "As duas senhas novas não são iguais."; conf.focus(); return; }
      btn.disabled = true;
      DB.alterarSenha(atual.value, nova.value).then(function () {
        m.fechar();
        toast(DB.demo ? "Modo demonstração: senha não foi alterada de verdade." : "Senha alterada! ✅");
      }).catch(function (err) {
        erroEl.textContent = err.amigavel ? err.message : "Não foi possível trocar a senha.";
        (err.campo === "atual" ? atual : nova).focus();
      }).then(function () { btn.disabled = false; });
    });
    var m = abrirModal([form]);
  });

  // ===========================================================================
  // Rotas: #/ perfis · #/perfil/<id> · #/clientes · #/cliente/novo · #/cliente/<id>
  // ===========================================================================
  function rotaEmEdicao() {
    if (estado.ed) return "#/perfil/" + estado.ed.p.id;
    if (estado.cl) return estado.cl.rota;
    return null;
  }
  var ignorarHash = false, hashAnterior = location.hash;
  window.addEventListener("hashchange", function () {
    if (ignorarHash) { ignorarHash = false; return; }
    if ($("telaApp").hidden) return;
    var emEdicao = rotaEmEdicao(), saindo = emEdicao && location.hash !== emEdicao;
    if (saindo && haAlteracoes()) {
      // Volta para a tela em edição e pergunta; se confirmar, segue para o destino.
      var destino = location.hash;
      ignorarHash = true;
      location.hash = hashAnterior;
      confirmarDescarte().then(function (sim) {
        if (!sim) return;
        descartarTudo();
        location.hash = destino;
      });
      return;
    }
    if (saindo) descartarTudo();
    hashAnterior = location.hash;
    rota();
  });
  window.addEventListener("beforeunload", function (e) {
    if (haAlteracoes()) { e.preventDefault(); e.returnValue = ""; }
  });

  var TELAS = ["telaLista", "telaEditor", "telaClientes", "telaCliente", "telaGestor"];
  function mostrarTela(id) {
    TELAS.forEach(function (t) { $(t).hidden = t !== id; });
    var emClientes = id === "telaClientes" || id === "telaCliente";
    $("abaClientes").classList.toggle("ativa", emClientes);
    $("abaGestor").classList.toggle("ativa", id === "telaGestor");
    $("abaPerfis").classList.toggle("ativa", !emClientes && id !== "telaGestor");
    window.scrollTo(0, 0);
  }

  function rota() {
    var h = location.hash, m;
    if ((m = h.match(/^#\/perfil\/([\w-]+)/))) abrirEditor(m[1]);
    else if (h === "#/clientes") mostrarClientes();
    else if (h === "#/gestor") mostrarGestor();
    else if ((m = h.match(/^#\/cliente\/([\w-]+)/))) abrirCliente(m[1]);
    else mostrarLista();
  }

  // ===========================================================================
  // Lista
  // ===========================================================================
  function mostrarLista() {
    mostrarTela("telaLista");
    document.title = "Perfis · Painel";
    $("lista").innerHTML = "";
    $("lista").appendChild(el("div", { class: "vazio", text: "Carregando…" }));
    Promise.all([DB.listar(), carregarSegmentos()]).then(function (res) {
      estado.perfis = res[0] || [];
      desenharFiltroSegmento();
      desenharLista();
    }).catch(falhou);
  }

  function desenharLista() {
    var todos = estado.perfis;
    var cont = { ativo: 0, inativo: 0, rascunho: 0, vencido: 0, teste: 0, "nao-fechou": 0 };
    todos.forEach(function (p) { cont[statusVisivel(p)]++; });
    $("resumo").textContent = todos.length + " perfis · " + cont.ativo + " no ar · " + (cont.teste ? cont.teste + " em teste · " : "") +
      (cont.vencido ? cont.vencido + " fora do ar por vencimento · " : "") + cont.inativo + " desativados · " + cont.rascunho + " em configuração" +
      (cont["nao-fechou"] ? " · " + cont["nao-fechou"] + (cont["nao-fechou"] === 1 ? " teste não fechou" : " testes não fecharam") : "");

    var b = estado.busca.trim().toLowerCase();
    var vis = todos.filter(function (p) {
      if (estado.filtroSeg && (estado.filtroSeg === "sem" ? p.segmento_id : p.segmento_id !== estado.filtroSeg)) return false;
      if (estado.filtroEsp.length && !estado.filtroEsp.some(function (id) { return (p.especialidades || []).indexOf(id) >= 0; })) return false;
      if (estado.filtro === "vencidos" && (!vencido(p) || p.teste_desde)) return false;   // testes têm filtros próprios
      if (["ativo", "inativo", "rascunho", "teste", "nao-fechou"].indexOf(estado.filtro) >= 0 && statusVisivel(p) !== estado.filtro) return false;
      if (!b) return true;
      var c = p.cliente || {};
      return [p.slug, c.nome, c.telefone, c.whatsapp, c.email, p.dados && p.dados.nome].join(" ").toLowerCase().indexOf(b) >= 0;
    });

    var alvo = $("lista");
    alvo.innerHTML = "";
    if (!todos.length) {
      alvo.appendChild(el("div", { class: "vazio" }, [icone("fa-solid fa-id-card"), "Nenhum perfil ainda. Clique em \"Ativar novo perfil\" para criar o primeiro."]));
      return;
    }
    if (!vis.length) { alvo.appendChild(el("div", { class: "vazio", text: "Nenhum perfil encontrado com esse filtro." })); return; }

    vis.forEach(function (p) {
      var url = DB.urlPerfil(p.slug);
      var foto = p.dados && p.dados.foto;
      var meta = [el("a", { href: url, target: "_blank", rel: "noopener" }, [icone("fa-solid fa-link"), " /" + p.slug])];
      if (p.cliente) meta.push(el("a", { href: "#/cliente/" + p.cliente.id }, [icone("fa-regular fa-user"), " " + p.cliente.nome]));
      var seg = nomeSegmento(p.segmento_id);
      var esps = nomesEspecialidades(p);
      if (seg) meta.push(el("span", {}, [icone("fa-solid fa-tag"), " " + seg + (esps.length ? " · " + esps.join(", ") : "")]));
      var tv = textoVencimento(p);
      if (tv) meta.push(el("span", { class: tv.classe }, [icone("fa-regular fa-calendar"), tv.texto]));

      var acoes = [
        el("a", { class: "btn pequeno", href: "#/perfil/" + p.id }, [icone("fa-solid fa-pen"), " Editar"])
      ];
      var t = DB.situacaoTeste(p);
      if (t) acoes.push(el("button", { class: "btn pequeno verde-leve", type: "button", title: "O cliente fechou: fica no ar e vence daqui a 1 mês", onclick: function () { efetivar(p).then(atualizarItem); } }, [icone("fa-solid fa-handshake"), " Efetivar"]));
      else if (p.status !== "rascunho" && tv && tv.classe) acoes.push(el("button", { class: "btn pequeno verde-leve", type: "button", title: "Somar 1 mês ao vencimento", onclick: function () { renovar(p).then(atualizarItem); } }, [icone("fa-solid fa-rotate-right"), " Renovar +1 mês"]));
      if (p.status === "ativo" && !(t && t.situacao === "nao-fechou")) acoes.push(el("button", { class: "btn pequeno perigo-leve", type: "button", onclick: function () { mudarStatus(p, "inativo").then(atualizarItem); } }, [icone("fa-solid fa-circle-pause"), " Desativar"]));
      else if (p.status === "rascunho") acoes.push(
        el("button", { class: "btn pequeno", type: "button", onclick: function () { mudarStatus(p, "ativo").then(atualizarItem); } }, [icone("fa-solid fa-circle-play"), " Liberar"]),
        el("button", { class: "btn pequeno", type: "button", title: "No ar por " + DB.CARENCIA_DIAS + " dias para o cliente experimentar", onclick: function () { liberarTeste(p).then(atualizarItem); } }, [icone("fa-solid fa-hourglass-half"), " Teste " + DB.CARENCIA_DIAS + " dias"]));
      else if (!t) acoes.push(el("button", { class: "btn pequeno", type: "button", onclick: function () { mudarStatus(p, "ativo").then(atualizarItem); } }, [icone("fa-solid fa-circle-play"), " Reativar"]));
      acoes.push(
        el("button", { class: "btn pequeno icone", type: "button", title: "QR Code", "aria-label": "QR Code", onclick: function () { mostrarQR(p); } }, [icone("fa-solid fa-qrcode")]),
        el("button", { class: "btn pequeno icone", type: "button", title: "Copiar link", "aria-label": "Copiar link", onclick: function () { Perfil.copiar(url, "Link copiado!"); } }, [icone("fa-regular fa-copy")]),
        el("button", { class: "btn pequeno icone perigo-leve", type: "button", title: "Excluir", "aria-label": "Excluir", onclick: function () {
          excluirPerfil(p).then(function (ok) { if (ok) { estado.perfis = estado.perfis.filter(function (x) { return x.id !== p.id; }); desenharLista(); } });
        } }, [icone("fa-solid fa-trash-can")])
      );

      alvo.appendChild(el("div", { class: "item" }, [
        foto ? el("img", { class: "item-foto", src: foto, alt: "" }) : el("div", { class: "item-foto" }, [icone("fa-regular fa-user")]),
        el("div", { class: "item-info" }, [
          el("div", { class: "item-nome" }, [nomeDe(p), seloPerfil(p)]),
          el("div", { class: "item-meta" }, meta)
        ]),
        el("div", { class: "item-acoes" }, acoes)
      ]));
    });
  }
  function atualizarItem(r) {
    if (!r) return;
    estado.perfis = estado.perfis.map(function (x) { return x.id === r.id ? r : x; });
    desenharLista();
  }

  $("busca").addEventListener("input", function () { estado.busca = this.value; desenharLista(); });
  $("filtroSegmento").addEventListener("change", function () { estado.filtroSeg = this.value; estado.filtroEsp = []; desenharFiltroEspecialidades(); desenharLista(); });

  // Segmentos (v1.7.0). Se o banco ainda não tiver segmentos, o painel segue funcionando sem eles.
  function carregarSegmentos() {
    return Promise.all([
      DB.listarSegmentos().then(function (l) { estado.segmentos = l || []; }, function () { estado.segmentos = []; }),
      DB.listarEspecialidades().then(function (l) { estado.especialidades = l || []; }, function () { estado.especialidades = []; })
    ]);
  }
  function especialidadesDe(segId) { return estado.especialidades.filter(function (e) { return e.segmento_id === segId; }); }
  function nomesEspecialidades(p) {
    return (p.especialidades || []).map(function (id) { var e = estado.especialidades.filter(function (x) { return x.id === id; })[0]; return e ? e.nome : null; }).filter(Boolean);
  }
  // Chips de especialidades para marcar (editor do perfil): mostra as do segmento escolhido
  function chipsEspecialidades(segId, marcadas, aoMudar) {
    var lista = especialidadesDe(segId);
    if (!segId || !lista.length) return el("div", { class: "dica", text: segId ? "Este segmento ainda não tem especialidades. Cadastre na aba Gestor." : "Escolha o segmento para marcar as especialidades." });
    return el("div", { class: "esp-chips" }, lista.map(function (e) {
      var c = el("input", { type: "checkbox" });
      c.checked = marcadas.indexOf(e.id) >= 0;
      var rot = el("label", { class: "esp-chip" + (c.checked ? " marcado" : "") }, [c, e.nome]);
      c.addEventListener("change", function () { rot.classList.toggle("marcado", c.checked); aoMudar(e.id, c.checked); });
      return rot;
    }));
  }
  function nomeSegmento(id) {
    var s = id && estado.segmentos.filter(function (x) { return x.id === id; })[0];
    return s ? s.nome : "";
  }
  function desenharFiltroSegmento() {
    var sel = $("filtroSegmento");
    sel.innerHTML = "";
    sel.appendChild(el("option", { value: "", text: "Todos os segmentos" }));
    estado.segmentos.forEach(function (s) { sel.appendChild(el("option", { value: s.id, text: s.nome })); });
    sel.appendChild(el("option", { value: "sem", text: "Sem segmento" }));
    if (estado.filtroSeg && estado.filtroSeg !== "sem" && !nomeSegmento(estado.filtroSeg)) estado.filtroSeg = "";
    sel.value = estado.filtroSeg;
    sel.hidden = !estado.segmentos.length;
    desenharFiltroEspecialidades();
  }
  // Refinar pela especialidade: aparece depois de escolher um segmento no filtro
  function desenharFiltroEspecialidades() {
    var caixa = $("filtroEspecialidades"), lista = estado.filtroSeg && estado.filtroSeg !== "sem" ? especialidadesDe(estado.filtroSeg) : [];
    estado.filtroEsp = estado.filtroEsp.filter(function (id) { return lista.some(function (e) { return e.id === id; }); });
    caixa.innerHTML = "";
    caixa.hidden = !lista.length;
    lista.forEach(function (e) {
      caixa.appendChild(el("button", { class: "chip" + (estado.filtroEsp.indexOf(e.id) >= 0 ? " ativo" : ""), type: "button", "aria-pressed": String(estado.filtroEsp.indexOf(e.id) >= 0), onclick: function () {
        var i = estado.filtroEsp.indexOf(e.id);
        if (i >= 0) estado.filtroEsp.splice(i, 1); else estado.filtroEsp.push(e.id);
        desenharFiltroEspecialidades(); desenharLista();
      } }, [e.nome]));
    });
  }
  $("filtroStatus").addEventListener("click", function (e) {
    var b = e.target.closest(".chip");
    if (!b) return;
    estado.filtro = b.dataset.f;
    Array.prototype.forEach.call(this.children, function (c) { c.classList.toggle("ativo", c === b); });
    desenharLista();
  });

  // ---------------------------------------------------------------------------
  // Novo perfil
  // ---------------------------------------------------------------------------
  $("btnNovo").addEventListener("click", function () { novoPerfil(null); });

  // Abre o modal de novo perfil. Com um cliente escolhido, a página já nasce com o
  // nome dele e os contatos do cadastro (WhatsApp, e-mail, redes, site, endereço).
  function novoPerfil(clienteId) {
    DB.listarClientes().then(function (clientes) {
      estado.clientes = clientes;
      var slugManual = false, nomeManual = false;
      var sel = el("select");
      sel.appendChild(el("option", { value: "", text: "— Sem cliente —" }));
      clientes.forEach(function (c) { sel.appendChild(el("option", { value: c.id, text: c.nome })); });
      if (clienteId) sel.value = clienteId;
      var nome = el("input", { type: "text", placeholder: "Ex.: Studio Bella Unhas", maxlength: "80" });
      var slug = el("input", { type: "text", placeholder: "studio-bella", maxlength: "40" });
      var importar = el("input", { type: "checkbox" });
      importar.checked = true;
      var linhaImportar = el("label", { class: "interruptor" }, [importar, "Já colocar na página os contatos e redes do cadastro"]);
      var endereco = el("input", { type: "checkbox" });
      endereco.checked = false;
      var linhaEndereco = el("label", { class: "interruptor" }, [endereco, "Incluir também o endereço (botão \"Como chegar\"). Ele fica público para quem ler o chaveiro"]);
      var erroEl = el("p", { class: "erro" });
      function clienteEscolhido() { return clientes.filter(function (c) { return c.id === sel.value; })[0] || null; }
      // O endereço só é oferecido junto com os contatos e quando o cadastro tem rua e cidade
      function atualizarEndereco() {
        var c = clienteEscolhido();
        linhaEndereco.hidden = !(importar.checked && c && c.logradouro && c.cidade);
        if (linhaEndereco.hidden) endereco.checked = false;
      }
      function aoTrocarCliente() {
        var c = clienteEscolhido();
        linhaImportar.hidden = !c;
        endereco.checked = false;   // sempre começa desmarcado
        atualizarEndereco();
        if (c && !nomeManual) { nome.value = c.nome.replace(/\s*\(exemplo\)$/, ""); if (!slugManual) slug.value = DB.gerarSlug(nome.value); }
      }
      sel.addEventListener("change", aoTrocarCliente);
      importar.addEventListener("change", atualizarEndereco);
      nome.addEventListener("input", function () { nomeManual = true; if (!slugManual) slug.value = DB.gerarSlug(nome.value); });
      slug.addEventListener("input", function () { slugManual = true; slug.value = slug.value.toLowerCase().replace(/[^a-z0-9-]/g, ""); });
      var btn = el("button", { class: "btn primario", type: "submit" }, [icone("fa-solid fa-plus"), " Criar e configurar"]);
      var form = el("form", {}, [
        el("h2", { text: "Ativar novo perfil" }),
        el("p", { text: "O perfil começa \"em configuração\". Depois de montar a página, clique em \"Liberar para o cliente\"." }),
        el("label", {}, ["Cliente", sel, el("div", { class: "dica" }, ["Não está na lista? ", el("a", { href: "#/cliente/novo", onclick: function () { m.fechar(); } }, ["Cadastre o cliente primeiro"]), "."])]),
        linhaImportar,
        linhaEndereco,
        el("label", {}, ["Nome na página", nome]),
        el("label", {}, ["Link do perfil",
          el("div", { class: "link-publico" }, [el("span", { text: DB.urlPerfil("") }), slug]),
          el("div", { class: "dica", text: "É este endereço que vai gravado no chaveiro. Evite mudar depois." })]),
        erroEl,
        el("div", { class: "modal-botoes" }, [el("button", { class: "btn", type: "button", text: "Cancelar", onclick: function () { m.fechar(); } }), btn])
      ]);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        erroEl.textContent = "";
        btn.disabled = true;
        var c = clienteEscolhido();
        var carregar = c && importar.checked ? DB.obterCliente(c.id) : Promise.resolve(null);
        carregar.then(function (completo) {
          var dados = { nome: nome.value.trim(), descricao: "", foto: "", capa: "", cor: "#7c3aed", tema: "escuro", links: [], mostrarSalvarContato: true, mostrarCompartilhar: true };
          if (completo) dados.links = linksDoCliente(completo, [], endereco.checked);
          return DB.criar({ slug: slug.value, cliente_id: c ? c.id : null, dados: dados });
        }).then(function (p) {
          m.fechar();
          location.hash = "#/perfil/" + p.id;
        }).catch(function (err) {
          erroEl.textContent = err.amigavel ? err.message : "Erro ao criar: " + err.message;
        }).then(function () { btn.disabled = false; });
      });
      var m = abrirModal([form]);
      aoTrocarCliente();
    }).catch(falhou);
  }

  // Links de página a partir do cadastro do cliente, sem repetir os que já existem.
  // O endereço (botão "Como chegar") só entra quando pedido: ele fica público para quem ler o chaveiro.
  function linksDoCliente(c, existentes, comEndereco) {
    var novos = [], redes = c.redes || {};
    function existe(tipo, campo, valor) {
      return existentes.concat(novos).some(function (l) { return l.tipo === tipo && String(l[campo] || "").replace(/\D/g, "") === String(valor).replace(/\D/g, "") && (campo !== "usuario" || l[campo] === valor); });
    }
    function add(l) { novos.push(Object.assign({ id: uid() }, l)); }
    if (c.whatsapp && !existentes.some(function (l) { return l.tipo === "whatsapp"; })) add({ tipo: "whatsapp", numero: c.whatsapp, mensagem: "Olá! Vim pelo seu chaveiro." });
    if (c.telefone && c.telefone !== c.whatsapp && !existe("telefone", "numero", c.telefone)) add({ tipo: "telefone", numero: "+" + c.telefone });
    if (c.email && !existentes.concat(novos).some(function (l) { return l.tipo === "email" && l.email === c.email; })) add({ tipo: "email", email: c.email });
    DB.REDES_CLIENTE.forEach(function (k) {
      if (k === "site" || !redes[k] || !TIPOS[k]) return;
      if (!existentes.concat(novos).some(function (l) { return l.tipo === k && String(l.usuario || "").replace(/^@/, "") === redes[k]; })) add({ tipo: k, usuario: redes[k] });
    });
    if (redes.site && !existentes.concat(novos).some(function (l) { return l.tipo === "site" && l.url === redes.site; })) add({ tipo: "site", url: redes.site });
    var endereco = [c.logradouro && (c.logradouro + (c.numero ? ", " + c.numero : "")), c.bairro, c.cidade && (c.cidade + (c.uf ? " - " + c.uf : "")), c.cep].filter(Boolean).join(", ");
    if (comEndereco && c.logradouro && c.cidade && !existentes.concat(novos).some(function (l) { return l.tipo === "maps"; }))
      add({ tipo: "maps", url: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(endereco) });
    return novos;
  }

  // ===========================================================================
  // Editor
  // ===========================================================================
  function descartarEdicao() {
    var ed = estado.ed;
    if (!ed) return;
    // Remove imagens enviadas nesta edição que não chegaram a ser salvas
    ed.imagensNovas.forEach(function (u) {
      if (u !== ed.orig.dados.foto && u !== ed.orig.dados.capa) DB.removerImagem(u);
    });
    estado.ed = null;
  }

  function abrirEditor(id) {
    mostrarTela("telaEditor");
    $("formEditor").innerHTML = "";
    $("previaTela").innerHTML = "";
    $("edTitulo").textContent = "Carregando…";
    $("edSelo").className = "";
    $("edSelo").textContent = "";
    Promise.all([DB.obter(id), DB.listarClientes(), carregarSegmentos()]).then(function (res) {
      var p = res[0];
      estado.clientes = res[1];
      if (!p) { toast("Perfil não encontrado.", true); location.hash = "#/"; return; }
      p.dados = Object.assign({ links: [] }, p.dados || {});
      p.dados.links = (p.dados.links || []).map(function (l) { return l.id ? l : Object.assign({ id: uid() }, l); });
      estado.ed = { orig: clonar(p), p: p, sujo: false, imagensNovas: [], aoMudar: [] };
      desenharEditor();
    }).catch(falhou);
  }

  function editaveis(x) {
    return JSON.stringify([x.slug, x.dados, x.cliente_id || null,
      x.vencimento ? String(x.vencimento).slice(0, 10) : null, x.observacoes || ""]);
  }
  function marcarSujo() {
    var ed = estado.ed;
    ed.sujo = editaveis(ed.p) !== editaveis(ed.orig);
    ed.aoMudar.forEach(function (f) { f(); });
    $("edSalvo").textContent = ed.sujo ? "Alterações não salvas" : "Tudo salvo";
    $("edSalvo").className = "salvo" + (ed.sujo ? " pendente" : "");
    atualizarPrevia();
  }
  var tPrevia;
  function atualizarPrevia() {
    clearTimeout(tPrevia);
    tPrevia = setTimeout(function () {
      if (!estado.ed) return;
      var tela = $("previaTela"), rolagem = tela.scrollTop;
      Perfil.render(tela, estado.ed.p.dados, { urlPublica: DB.urlPerfil(estado.ed.p.slug), mostrarIncompletos: true });
      tela.scrollTop = rolagem;
    }, 120);
  }
  function cabecalhoEditor() {
    var p = estado.ed.p;
    $("edTitulo").textContent = nomeDe(p);
    var s = seloPerfil(estado.ed.orig);
    $("edSelo").replaceWith(s);
    s.id = "edSelo";
    document.title = nomeDe(p) + " · Painel";
  }

  var cartao = EditorPerfil.cartao;

  function desenharEditor() {
    var ed = estado.ed, p = ed.p, d = p.dados;
    var form = $("formEditor");
    form.innerHTML = "";
    ed.aoMudar = [];
    cabecalhoEditor();

    // --- Status e link ---------------------------------------------------------
    var svOrig = statusVisivel(ed.orig), tOrig = DB.situacaoTeste(ed.orig);
    var stVis = ["vencido", "teste", "nao-fechou"].indexOf(svOrig) >= 0 ? svOrig : p.status;
    var st = TEXTO_STATUS[stVis];
    var botoesStatus = el("div", { class: "status-botoes" });
    var vOrig = DB.situacaoVencimento(ed.orig.vencimento);
    var avisoVenc = tOrig && tOrig.situacao === "teste"
      ? el("p", { class: "aviso-vencimento" }, [icone("fa-solid fa-hourglass-half"), " Teste até " + dataBR(tOrig.ate) + ". Depois disso, a página sai do ar sozinha. Se o cliente fechar, clique em \"Efetivar\"."])
      : p.status === "ativo" && vOrig.situacao === "carencia"
      ? el("p", { class: "aviso-vencimento" }, [icone("fa-solid fa-triangle-exclamation"), " Venceu em " + dataBR(vOrig.vencimento) + ". Se não for renovado, sai do ar sozinho em " + dataBR(vOrig.saiDoAr) + "."])
      : null;
    function acaoStatus(novo) {
      var antes = estado.ed.sujo ? salvar() : Promise.resolve(true);
      antes.then(function (ok) {
        if (!ok) return;
        mudarStatus(estado.ed.p, novo).then(function (r) {
          if (!r || !estado.ed) return;
          estado.ed.p.status = estado.ed.orig.status = r.status;
          desenharEditor();
        });
      });
    }
    function acaoTeste() {
      var antes = estado.ed.sujo ? salvar() : Promise.resolve(true);
      antes.then(function (ok) {
        if (!ok) return;
        liberarTeste(estado.ed.p).then(function (r) {
          if (!r || !estado.ed) return;
          ["status", "vencimento", "teste_desde"].forEach(function (k) { estado.ed.p[k] = estado.ed.orig[k] = r[k]; });
          desenharEditor();
        });
      });
    }
    if (p.status === "rascunho") botoesStatus.appendChild(el("button", { class: "btn verde", type: "button", onclick: function () { acaoStatus("ativo"); } }, [icone("fa-solid fa-rocket"), " Liberar para o cliente"]));
    if (p.status === "rascunho") botoesStatus.appendChild(el("button", { class: "btn", type: "button", onclick: acaoTeste }, [icone("fa-solid fa-hourglass-half"), " Liberar teste (" + DB.CARENCIA_DIAS + " dias)"]));
    if (p.status === "inativo" && !tOrig) botoesStatus.appendChild(el("button", { class: "btn verde", type: "button", onclick: function () { acaoStatus("ativo"); } }, [icone("fa-solid fa-circle-play"), " Reativar"]));
    if (tOrig || p.status === "ativo" && (vOrig.situacao === "fora" || vOrig.situacao === "carencia")) botoesStatus.appendChild(el("button", { class: "btn verde", type: "button", onclick: function () {
      var antes = estado.ed.sujo ? salvar() : Promise.resolve(true);
      antes.then(function (ok) {
        if (!ok) return;
        renovar(estado.ed.orig).then(function (r) {
          if (!r || !estado.ed) return;
          ["status", "vencimento", "teste_desde"].forEach(function (k) { estado.ed.p[k] = estado.ed.orig[k] = r[k]; });
          desenharEditor();
        });
      });
    } }, tOrig ? [icone("fa-solid fa-handshake"), " Efetivar (+1 mês)"] : [icone("fa-solid fa-rotate-right"), " Renovar +1 mês"]));
    if (p.status === "ativo" && !(tOrig && tOrig.situacao === "nao-fechou")) botoesStatus.appendChild(el("button", { class: "btn perigo", type: "button", onclick: function () { acaoStatus("inativo"); } }, [icone("fa-solid fa-circle-pause"), " Desativar"]));

    var slugInput = el("input", { type: "text", maxlength: "40" });
    slugInput.value = p.slug;
    slugInput.addEventListener("input", function () {
      slugInput.value = slugInput.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
      p.slug = slugInput.value;
      marcarSujo();
    });
    var url = DB.urlPerfil(ed.orig.slug);

    form.appendChild(cartao("fa-solid fa-signal", "Situação e link", [
      el("div", { class: "status-caixa " + stVis }, [
        el("div", {}, [el("strong", { text: st[0] }), el("p", { text: st[1] })]),
        botoesStatus
      ]),
      avisoVenc,
      el("label", { style: "margin-top:16px" }, ["Link do perfil (gravado no chaveiro)",
        el("div", { class: "link-publico" }, [el("span", { text: DB.urlPerfil("") }), slugInput]),
        el("div", { class: "dica", text: p.status === "rascunho" ? "Pode ajustar à vontade enquanto estiver em configuração." : "⚠️ Se mudar, o chaveiro já gravado com o link antigo para de funcionar." })
      ]),
      el("div", { class: "status-botoes", style: "margin-top:12px" }, [
        el("a", { class: "btn pequeno", href: url, target: "_blank", rel: "noopener" }, [icone("fa-solid fa-arrow-up-right-from-square"), " Abrir página"]),
        el("button", { class: "btn pequeno", type: "button", onclick: function () { Perfil.copiar(url, "Link copiado!"); } }, [icone("fa-regular fa-copy"), " Copiar link"]),
        el("button", { class: "btn pequeno", type: "button", onclick: function () { mostrarQR(ed.orig); } }, [icone("fa-solid fa-qrcode"), " QR Code"])
      ])
    ]));

    form.appendChild(cartaoLinkCliente(ed));

    // --- Aparência, informações, links e botões extras (js/editor-perfil.js, o mesmo da página do cliente)
    var desenharLinks = EditorPerfil.montar(form, {
      dados: d, aoMudar: ed.aoMudar, marcarSujo: marcarSujo, falhou: falhou,
      aoMudarNome: function () { $("edTitulo").textContent = nomeDe(p); },
      enviarImagem: function (blob, chave) { return DB.enviarImagem(ed.p.id, blob, chave); },
      registrarImagem: function (u) { ed.imagensNovas.push(u); },
      ativo: function () { return estado.ed === ed; }
    }).desenharLinks;

    // --- Cliente e cobrança (interno) --------------------------------------------------
    var selCliente = el("select");
    selCliente.appendChild(el("option", { value: "", text: "— Sem cliente —" }));
    estado.clientes.forEach(function (c) { selCliente.appendChild(el("option", { value: c.id, text: c.nome })); });
    selCliente.value = p.cliente_id || "";
    var linkCliente = el("a", { class: "btn pequeno" }, [icone("fa-regular fa-address-card"), " Abrir cadastro"]);
    var btnImportar = el("button", { class: "btn pequeno", type: "button", onclick: function () {
      if (!p.cliente_id) return;
      DB.obterCliente(p.cliente_id).then(function (c) {
        var novos = c ? linksDoCliente(c, d.links, false) : [];
        if (!novos.length) { toast("A página já tem todos os contatos do cadastro."); return; }
        d.links = d.links.concat(novos);
        desenharLinks();
        marcarSujo();
        toast(novos.length + (novos.length === 1 ? " link adicionado" : " links adicionados") + " no fim da lista.");
      }).catch(falhou);
    }, title: "Traz WhatsApp, telefone, e-mail, redes e site. O endereço não entra: adicione um link do Google Maps se quiser." }, [icone("fa-solid fa-file-import"), " Trazer contatos do cadastro"]);
    function atualizarCliente() {
      linkCliente.hidden = btnImportar.hidden = !p.cliente_id;
      if (p.cliente_id) linkCliente.setAttribute("href", "#/cliente/" + p.cliente_id);
    }
    selCliente.addEventListener("change", function () {
      p.cliente_id = selCliente.value || null;
      p.cliente = estado.clientes.filter(function (c) { return c.id === p.cliente_id; })[0] || null;
      atualizarCliente(); marcarSujo();
    });
    atualizarCliente();

    form.appendChild(cartao("fa-solid fa-lock", "Cliente e cobrança", [
      el("p", { class: "sub", style: "margin:-6px 0 14px", text: "Só você vê. Não aparece na página." }),
      el("div", { class: "grade" }, [
        el("label", { class: "todo" }, ["Cliente", selCliente,
          el("div", { class: "status-botoes", style: "margin-top:8px" }, [linkCliente, btnImportar, el("a", { class: "btn pequeno fantasma", href: "#/cliente/novo" }, [icone("fa-solid fa-user-plus"), " Novo cliente"])])]),
        campoVencimento(p),
        campoSegmento(p),
        campoTexto("Observações", p.observacoes, function (v) { p.observacoes = v; marcarSujo(); }, { classe: "todo", multilinha: true, ph: "Forma de pagamento, nº do chaveiro, combinados..." })
      ])
    ]));

    form.appendChild(cartaoHistorico(ed));

    // --- Excluir ---------------------------------------------------------------------
    form.appendChild(cartao("fa-solid fa-triangle-exclamation", "Excluir perfil", [
      el("p", { class: "sub", style: "margin:-6px 0 14px", text: "Apaga a página, os links e as fotos. O cadastro do cliente continua. Não pode ser desfeito." }),
      el("button", { class: "btn perigo", type: "button", onclick: function () {
        excluirPerfil(estado.ed.orig).then(function (ok) {
          if (!ok) return;
          estado.ed.sujo = false;
          estado.ed.imagensNovas = [];
          estado.ed = null;
          location.hash = "#/";
        });
      } }, [icone("fa-solid fa-trash-can"), " Excluir permanentemente"])
    ]));

    marcarSujo();
  }

  // Campo "Segmento" do editor (o cliente também pode escolher no painel dele)
  function campoSegmento(p) {
    var sel = el("select");
    sel.appendChild(el("option", { value: "", text: "— Sem segmento —" }));
    estado.segmentos.forEach(function (s) { sel.appendChild(el("option", { value: s.id, text: s.nome })); });
    sel.value = p.segmento_id || "";
    var caixaEsp = el("div");
    function desenharEsp() {
      caixaEsp.innerHTML = "";
      caixaEsp.appendChild(chipsEspecialidades(p.segmento_id, p.especialidades || [], function (id, marcada) {
        var l = (p.especialidades || []).filter(function (x) { return x !== id; });
        if (marcada) l.push(id);
        p.especialidades = l; marcarSujo();
      }));
    }
    sel.addEventListener("change", function () {
      p.segmento_id = sel.value || null;
      // Especialidades de outro segmento não valem mais
      p.especialidades = (p.especialidades || []).filter(function (id) { return especialidadesDe(p.segmento_id).some(function (e) { return e.id === id; }); });
      desenharEsp(); marcarSujo();
    });
    desenharEsp();
    return el("div", { class: "todo" }, [
      el("label", {}, ["Segmento", sel]),
      el("div", { class: "rotulo-esp", text: "Especialidades" }), caixaEsp,
      el("div", { class: "dica" }, ["O cliente também pode escolher no painel dele. ", el("a", { href: "#/gestor", text: "Gerenciar segmentos e especialidades" })])
    ]);
  }

  // Campo "Próximo vencimento" do editor, com o botão que soma 1 mês (vale ao salvar)
  function campoVencimento(p) {
    var campo = campoTexto("Próximo vencimento", p.vencimento ? String(p.vencimento).slice(0, 10) : "", function (v) { p.vencimento = v || null; marcarSujo(); },
      { tipo: "date", dica: "Depois do vencimento, a página continua no ar por mais " + DB.CARENCIA_DIAS + " dias e então sai do ar sozinha. Ao renovar, volta na hora. Sem data, nunca sai do ar." });
    var input = campo.querySelector("input");
    input.min = "2000-01-01"; input.max = "2099-12-31";
    var btn = el("button", { class: "btn pequeno", type: "button", title: "Soma 1 mês ao vencimento atual (ou a hoje, se estiver vazio)", onclick: function () {
      var atual = DB.dataISO(p.vencimento);
      p.vencimento = DB.somarMes(atual && +atual.slice(0, 4) >= 2000 ? atual : DB.hojeBrasilia());
      input.value = p.vencimento;
      marcarSujo();
      toast("Vencimento: " + dataBR(p.vencimento) + ". Clique em Salvar para valer.");
    } }, [icone("fa-solid fa-rotate-right"), " +1 mês"]);
    var depois = input.nextSibling;   // a dica, que continua embaixo
    campo.insertBefore(el("div", { class: "campo-com-botao" }, [input, btn]), depois);
    return campo;
  }

  // ---------------------------------------------------------------------------
  // Link para o cliente editar (v1.3.0) e histórico de alterações
  // ---------------------------------------------------------------------------
  function dataHora(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  function cartaoLinkCliente(ed) {
    var corpo = el("div", {}, [el("p", { class: "sub", text: "Carregando…" })]);
    var c = cartao("fa-solid fa-user-pen", "Link para o cliente editar", [corpo]);
    if (DB.demo || !DB.linkCliente) { corpo.replaceChildren(el("p", { class: "sub", text: "Disponível com o Supabase configurado (não funciona no modo demonstração)." })); return c; }
    function desenhar() {
      var p = ed.orig;
      var podeGerar = p.status === "ativo" && !DB.foraPorVencimento(p) && !!p.cliente_id;
      DB.linkCliente(p.id).then(function (l) {
        if (estado.ed !== ed) return;
        var ativo = !!(l && !l.revogado_em);
        var itens = [el("p", { class: "sub", style: "margin:-6px 0 12px", text: "O cliente abre o link, digita o PIN (os 4 últimos dígitos do WhatsApp ou do telefone do cadastro) e edita fotos, cores, textos e links. O link do perfil, a situação e a cobrança continuam só com você. As alterações vão ao ar quando ele clica em Salvar." })];
        if (ativo) itens.push(el("p", {}, [el("strong", { text: "Link ativo" }), " desde " + dataHora(l.criado_em) +
          (l.ultimo_acesso ? " · último acesso " + dataHora(l.ultimo_acesso) : " · ainda não usado") +
          (l.bloqueado_ate && new Date(l.bloqueado_ate) > new Date() ? " · bloqueado por PIN errado até " + dataHora(l.bloqueado_ate) : "")]));
        else if (l && l.revogado_em) itens.push(el("p", { class: "sub", text: "O último link foi revogado em " + dataHora(l.revogado_em) + "." }));
        if (!podeGerar) itens.push(el("p", { class: "aviso-vencimento", text: !p.cliente_id ? "Ligue um cliente a este perfil (em \"Cliente e cobrança\") e salve para gerar o link." : "O perfil precisa estar no ar para gerar o link." }));
        var botoes = el("div", { class: "status-botoes" });
        if (podeGerar) botoes.appendChild(el("button", { class: "btn primario", type: "button", onclick: function () { gerar(ativo); } }, [icone("fa-solid fa-link"), ativo ? " Gerar novo link" : " Gerar link para o cliente"]));
        if (ativo) botoes.appendChild(el("button", { class: "btn perigo-leve", type: "button", onclick: revogar }, [icone("fa-solid fa-ban"), " Revogar link"]));
        itens.push(botoes);
        corpo.replaceChildren.apply(corpo, itens);
      }).catch(function (e) { corpo.replaceChildren(el("p", { class: "erro", text: "Não foi possível carregar o link: " + (e && e.message || e) })); });
    }
    function gerar(substitui) {
      (substitui ? confirmar({ titulo: "Gerar um novo link?", texto: "O link atual para de funcionar na hora. Depois envie o novo para o cliente.", botao: "Gerar novo link" }) : Promise.resolve(true)).then(function (sim) {
        if (!sim) return;
        return DB.gerarLinkCliente(ed.orig.id).then(function (url) { mostrarLinkGerado(url, ed.orig); desenhar(); });
      }).catch(falhou);
    }
    function revogar() {
      confirmar({ titulo: "Revogar o link do cliente?", texto: "O link para de funcionar na hora, mesmo que o cliente esteja com a página aberta. Dá para gerar outro quando quiser.", botao: "Revogar", classe: "perigo" }).then(function (sim) {
        if (!sim) return;
        return DB.revogarLinkCliente(ed.orig.id).then(function () { toast("Link revogado."); desenhar(); });
      }).catch(falhou);
    }
    desenhar();
    return c;
  }
  function mostrarLinkGerado(url, p) {
    var cliente = p.cliente || {}, tel = DB.soDigitos(cliente.whatsapp || "");
    var msg = "Olá" + (cliente.nome ? ", " + cliente.nome.split(" ")[0] : "") + "! Este é o link para você editar a sua página " + DB.urlPerfil(p.slug) + ":\n" + url +
      "\n\nPara entrar, use os 4 últimos dígitos do seu telefone cadastrado.";
    var m = abrirModal([
      el("h2", { text: "Link para o cliente" }),
      el("p", { text: "Copie e envie agora. Por segurança, o link não fica guardado e não aparece de novo: para reenviar, gere outro." }),
      el("div", { class: "link-gerado", text: url }),
      el("div", { class: "modal-botoes" }, [
        el("button", { class: "btn", type: "button", onclick: function () { Perfil.copiar(url, "Link copiado!"); } }, [icone("fa-regular fa-copy"), " Copiar link"]),
        tel ? el("a", { class: "btn verde", href: "https://wa.me/" + tel + "?text=" + encodeURIComponent(msg), target: "_blank", rel: "noopener" }, [icone("fa-brands fa-whatsapp"), " Enviar pelo WhatsApp"]) : null,
        el("button", { class: "btn primario", type: "button", onclick: function () { m.fechar(); } }, ["Pronto"])
      ])
    ]);
  }
  function cartaoHistorico(ed) {
    var corpo = el("div", {}, [el("p", { class: "sub", text: "Carregando…" })]);
    var c = cartao("fa-solid fa-clock-rotate-left", "Histórico de alterações", [corpo]);
    if (DB.demo || !DB.historico) { c.hidden = true; return c; }
    DB.historico(ed.orig.id).then(function (lista) {
      if (estado.ed !== ed) return;
      if (!lista || !lista.length) { corpo.replaceChildren(el("p", { class: "sub", text: "Ainda sem alterações registradas. Cada vez que a página é salva, por você ou pelo cliente, a versão anterior fica guardada aqui." })); return; }
      corpo.replaceChildren(
        el("p", { class: "sub", style: "margin:-6px 0 10px", text: "Versões anteriores da página. \"Carregar\" coloca a versão no editor: confira a prévia e clique em Salvar." }),
        el("div", { class: "historico" }, lista.map(function (h) {
          return el("div", { class: "historico-item" }, [
            el("span", {}, [el("strong", { text: dataHora(h.criado_em) }), " · antes de uma alteração " + (h.autor === "cliente" ? "do cliente" : "sua")]),
            el("button", { class: "btn pequeno", type: "button", onclick: function () {
              var dados = Object.assign({ links: [] }, clonar(h.dados));
              dados.links = (dados.links || []).map(function (l) { return l.id ? l : Object.assign({ id: uid() }, l); });
              ed.p.dados = dados;
              desenharEditor();
              toast("Versão carregada no editor. Confira a prévia e clique em Salvar.");
            } }, [icone("fa-solid fa-rotate-left"), " Carregar"])
          ]);
        })));
    }).catch(function () { corpo.replaceChildren(el("p", { class: "erro", text: "Não foi possível carregar o histórico." })); });
    return c;
  }

  // ---------------------------------------------------------------------------
  // Salvar
  // ---------------------------------------------------------------------------
  function salvar() {
    var ed = estado.ed;
    if (!ed) return Promise.resolve(false);
    if (ed.salvando) return ed.salvando;               // Ctrl+S repetido: usa o salvamento em andamento
    var btn = $("btnSalvar");
    btn.disabled = true;
    var p = ed.p, patch = {
      dados: p.dados, cliente_id: p.cliente_id || null, segmento_id: p.segmento_id || null, especialidades: p.segmento_id ? (p.especialidades || []) : [],
      vencimento: p.vencimento || null, observacoes: p.observacoes || null
    };
    if (p.slug !== ed.orig.slug) patch.slug = p.slug;
    // Mudar o vencimento de um perfil em teste conta como efetivar
    if (ed.orig.teste_desde && DB.dataISO(p.vencimento) !== DB.dataISO(ed.orig.vencimento)) patch.teste_desde = null;
    var antigas = [ed.orig.dados.foto, ed.orig.dados.capa];

    ed.salvando = DB.salvar(p.id, patch).then(function (r) {
      if (estado.ed !== ed) return true;
      // Apaga do armazenamento as imagens que deixaram de ser usadas
      antigas.concat(ed.imagensNovas).forEach(function (u) {
        if (u && u !== p.dados.foto && u !== p.dados.capa) DB.removerImagem(u);
      });
      ed.imagensNovas = [];
      var slugMudou = r.slug !== ed.orig.slug;
      var vencMudou = DB.dataISO(r.vencimento) !== DB.dataISO(ed.orig.vencimento) || (r.cliente_id || null) !== (ed.orig.cliente_id || null);
      r.dados = p.dados;
      ed.orig = clonar(r);
      ed.p.slug = r.slug;
      ed.p.cliente = r.cliente || null;
      ed.p.vencimento = r.vencimento;
      ed.p.teste_desde = r.teste_desde || null;
      if (slugMudou || vencMudou) { var y = window.scrollY; desenharEditor(); window.scrollTo(0, y); }   // a situação (no ar / vencido) pode ter mudado
      else { cabecalhoEditor(); marcarSujo(); }
      toast("Salvo! ✅");
      return true;
    }).catch(function (e) { falhou(e); return false; })
      .then(function (ok) { btn.disabled = false; ed.salvando = null; return ok; });
    return ed.salvando;
  }
  $("btnSalvar").addEventListener("click", function () { salvar(); });
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && (estado.ed || estado.cl)) { e.preventDefault(); if (estado.ed) salvar(); else salvarCliente(); }
  });
  $("btnPrevia").addEventListener("click", function () { $("previa").classList.add("aberta"); });
  $("btnFecharPrevia").addEventListener("click", function () { $("previa").classList.remove("aberta"); });

  // ===========================================================================
  // Clientes
  // ===========================================================================
  var TEXTO_REDES = {
    instagram: ["Instagram", "fa-brands fa-instagram", "usuario"], facebook: ["Facebook", "fa-brands fa-facebook-f", "usuario ou página"],
    tiktok: ["TikTok", "fa-brands fa-tiktok", "usuario"], youtube: ["YouTube", "fa-brands fa-youtube", "canal"],
    linkedin: ["LinkedIn", "fa-brands fa-linkedin-in", "usuario"], x: ["X (Twitter)", "fa-brands fa-x-twitter", "usuario"],
    kwai: ["Kwai", "fa-solid fa-video", "usuario"], pinterest: ["Pinterest", "fa-brands fa-pinterest-p", "usuario"],
    telegram: ["Telegram", "fa-brands fa-telegram", "usuario"], site: ["Site", "fa-solid fa-globe", "www.exemplo.com.br"]
  };

  // Formatação para exibir (o banco guarda só os números)
  function fmtDoc(v) {
    var d = DB.soDigitos(v);
    if (d.length <= 11) return d.replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
    return d.slice(0, 14).replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2");
  }
  function fmtTel(v) {
    var d = DB.soDigitos(v);
    if (d.length >= 12 && d.indexOf("55") === 0) d = d.slice(2);
    if (d.length > 11) return "+" + d;
    if (d.length > 10) return d.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3");
    if (d.length > 6) return d.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
    if (d.length > 2) return d.replace(/^(\d{2})(\d*)/, "($1) $2");
    return d;
  }
  function fmtCep(v) { var d = DB.soDigitos(v).slice(0, 8); return d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d; }
  function fmtValor(v) { return v == null || v === "" ? "" : Number(v).toFixed(2).replace(".", ","); }
  function cidadeUF(c) { return [c.cidade, c.uf].filter(Boolean).join("/"); }

  // ===========================================================================
  // Painel do gestor (v1.7.0): segmentos e links/avisos nos painéis dos clientes. Só administradores.
  // ===========================================================================
  var ICONES_NOMES = {
    "fa-solid fa-headset": "Suporte", "fa-brands fa-whatsapp": "WhatsApp", "fa-solid fa-circle-info": "Informação",
    "fa-solid fa-triangle-exclamation": "Atenção", "fa-solid fa-link": "Link", "fa-solid fa-circle-play": "Vídeo / tutorial", "fa-solid fa-gift": "Promoção"
  };
  function mostrarGestor() {
    mostrarTela("telaGestor");
    document.title = "Gestor · Painel";
    $("gestor").innerHTML = "";
    $("gestor").appendChild(el("div", { class: "vazio", text: "Carregando…" }));
    carregarGestor();
  }
  function carregarGestor() {
    return Promise.all([DB.listarSegmentos(), DB.listarAvisos(), DB.listar(), DB.listarEspecialidades()]).then(function (res) {
      estado.segmentos = res[0] || []; estado.avisos = res[1] || []; estado.perfis = res[2] || []; estado.especialidades = res[3] || [];
      var alvo = $("gestor");
      alvo.innerHTML = "";
      alvo.appendChild(cartaoSegmentos());
      alvo.appendChild(cartaoAvisos());
    }).catch(falhou);
  }

  // Janela com um campo de texto. Devolve o texto, ou null se cancelar.
  function pedirTexto(o) {
    return new Promise(function (ok) {
      var resolvido = false, m;
      var input = el("input", { type: "text", maxlength: String(o.max || 60) });
      input.value = o.valor || "";
      function confirmarTexto() { resolvido = true; m.fechar(); ok(input.value); }
      input.addEventListener("keydown", function (e) { if (e.key === "Enter") confirmarTexto(); });
      m = abrirModal([
        el("h2", { text: o.titulo }), input,
        el("div", { class: "modal-botoes" }, [
          el("button", { class: "btn", type: "button", text: "Cancelar", onclick: function () { m.fechar(); } }),
          el("button", { class: "btn primario", type: "button", text: o.botao || "Salvar", onclick: confirmarTexto })
        ])
      ], function () { if (!resolvido) ok(null); });
    });
  }

  function cartaoSegmentos() {
    var nome = el("input", { type: "text", maxlength: "60", placeholder: "Novo segmento (ex.: Beleza e estética)", "aria-label": "Nome do novo segmento" });
    function adicionar() {
      DB.salvarSegmento(null, nome.value).then(function () { toast("Segmento incluído. ✅"); carregarGestor(); }).catch(falhou);
    }
    nome.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); adicionar(); } });
    var lista = el("div", { class: "gestor-lista" });
    if (!estado.segmentos.length) lista.appendChild(el("p", { class: "sub", text: "Nenhum segmento ainda." }));
    estado.segmentos.forEach(function (s) {
      lista.appendChild(el("div", { class: "gestor-segmento" }, [el("div", { class: "gestor-linha" }, [
        el("span", { class: "gestor-icone" }, [icone("fa-solid fa-tag")]),
        el("div", { class: "gestor-info" }, [el("strong", { text: s.nome }), el("small", { text: s.total_perfis + (s.total_perfis === 1 ? " perfil" : " perfis") })]),
        el("div", { class: "gestor-acoes" }, [
          el("button", { class: "btn pequeno", type: "button", onclick: function () {
            pedirTexto({ titulo: "Renomear segmento", valor: s.nome, max: 60 }).then(function (v) {
              if (v == null) return;
              return DB.salvarSegmento(s.id, v).then(function () { toast("Segmento renomeado."); carregarGestor(); });
            }).catch(falhou);
          } }, [icone("fa-solid fa-pen"), " Renomear"]),
          el("button", { class: "btn pequeno icone perigo-leve", type: "button", title: "Excluir", "aria-label": "Excluir " + s.nome, onclick: function () {
            confirmar({
              titulo: "Excluir o segmento \"" + s.nome + "\"?",
              texto: (s.total_perfis ? s.total_perfis + (s.total_perfis === 1 ? " perfil fica" : " perfis ficam") + " sem segmento. Nenhum perfil é apagado." : "Nenhum perfil usa este segmento.") +
                (especialidadesDe(s.id).length ? " As especialidades dele também são excluídas." : ""),
              botao: "Excluir", classe: "perigo"
            }).then(function (sim) {
              if (sim) return DB.excluirSegmento(s.id).then(function () { toast("Segmento excluído."); carregarGestor(); });
            }).catch(falhou);
          } }, [icone("fa-solid fa-trash-can")])
        ])
      ]), cartaoEspecialidades(s)]));
    });
    return cartao("fa-solid fa-tags", "Segmentos", [
      el("p", { class: "sub", style: "margin:-6px 0 14px", text: "O tipo de negócio de cada perfil e, dentro de cada segmento, as especialidades (ex.: Salão de Beleza → Lash Design, Manicure). Você escolhe no editor do perfil; o cliente também pode escolher no painel dele, só entre os desta lista." }),
      el("div", { class: "gestor-adicionar" }, [nome, el("button", { class: "btn primario", type: "button", onclick: adicionar }, [icone("fa-solid fa-plus"), " Adicionar"])]),
      lista
    ]);
  }

  // Especialidades (micro segmentos) dentro de um segmento, no cartão "Segmentos"
  function cartaoEspecialidades(s) {
    var nome = el("input", { type: "text", maxlength: "60", placeholder: "Nova especialidade (ex.: Lash Design)", "aria-label": "Nova especialidade em " + s.nome });
    function adicionar() {
      DB.salvarEspecialidade(null, s.id, nome.value).then(function () { toast("Especialidade incluída. ✅"); carregarGestor(); }).catch(falhou);
    }
    nome.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); adicionar(); } });
    var tags = el("div", { class: "esp-chips" }, especialidadesDe(s.id).map(function (e) {
      var usos = estado.perfis.filter(function (p) { return (p.especialidades || []).indexOf(e.id) >= 0; }).length;
      return el("span", { class: "esp-tag", title: usos + (usos === 1 ? " perfil" : " perfis") }, [
        el("button", { class: "esp-tag-nome", type: "button", title: "Renomear", onclick: function () {
          pedirTexto({ titulo: "Renomear especialidade", valor: e.nome, max: 60 }).then(function (v) {
            if (v == null) return;
            return DB.salvarEspecialidade(e.id, s.id, v).then(function () { toast("Especialidade renomeada."); carregarGestor(); });
          }).catch(falhou);
        } }, [e.nome, el("small", { text: " " + usos })]),
        el("button", { class: "esp-tag-x", type: "button", title: "Excluir", "aria-label": "Excluir " + e.nome, onclick: function () {
          confirmar({ titulo: "Excluir a especialidade \"" + e.nome + "\"?", texto: usos ? "Ela sai de " + usos + (usos === 1 ? " perfil" : " perfis") + ". Nenhum perfil é apagado." : "Nenhum perfil usa esta especialidade.", botao: "Excluir", classe: "perigo" }).then(function (sim) {
            if (sim) return DB.excluirEspecialidade(e.id).then(function () { toast("Especialidade excluída."); carregarGestor(); });
          }).catch(falhou);
        } }, [icone("fa-solid fa-xmark")])
      ]);
    }));
    return el("div", { class: "gestor-especialidades" }, [
      tags,
      el("div", { class: "gestor-adicionar pequeno" }, [nome, el("button", { class: "btn pequeno", type: "button", onclick: adicionar }, [icone("fa-solid fa-plus"), " Especialidade"])])
    ]);
  }

  var ONDE_NOMES = { painel: "Painel do cliente", pagina: "Página do perfil", ambos: "Painel e página" };
  function dataHoraBR(iso) {
    var d = new Date(iso);
    return isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  // Data do banco → campo "data e hora" (no horário deste computador), e o contrário
  function paraCampoData(iso) {
    var d = iso ? new Date(iso) : null;
    if (!d || isNaN(d.getTime())) return "";
    var z = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + z(d.getMonth() + 1) + "-" + z(d.getDate()) + "T" + z(d.getHours()) + ":" + z(d.getMinutes());
  }
  function deCampoData(v) { return v ? new Date(v).toISOString() : null; }
  // Situação de um link/aviso (v1.7.3). O limite por perfil não encerra para todos.
  function estadoAviso(a) {
    var agora = Date.now();
    if (!a.ativo) return { texto: "Desligado", ativo: false };
    if (a.inicio && new Date(a.inicio).getTime() > agora) return { texto: "Agendado para " + dataHoraBR(a.inicio), ativo: false };
    if (a.fim && new Date(a.fim).getTime() <= agora) return { texto: "Encerrado por data", ativo: false };
    if (a.max_cliques_total && (a.cliques_total || 0) >= a.max_cliques_total) return { texto: "Encerrado por cliques", ativo: false };
    return { texto: "Ativo", ativo: true };
  }

  function descreverAlvo(a) {
    if (a.alvo === "segmentos") {
      var es = (a.especialidades || []).map(function (id) { var e = estado.especialidades.filter(function (x) { return x.id === id; })[0]; return e ? e.nome : null; }).filter(Boolean);
      return "Segmentos: " + (a.segmentos || []).map(function (id) { return nomeSegmento(id) || "(excluído)"; }).join(", ") + (es.length ? " (" + es.join(", ") + ")" : "");
    }
    if (a.alvo === "perfis") { var n = (a.perfis || []).length; return n + (n === 1 ? " perfil" : " perfis"); }
    return "Todos os perfis";
  }
  function verCliques(a) {
    DB.listarCliquesAviso(a.id).then(function (lista) {
      var nomes = {};
      estado.perfis.forEach(function (p) { nomes[p.id] = nomeDe(p) + " (/" + p.slug + ")"; });
      var m = abrirModal([
        el("h2", { text: "Cliques em \"" + a.titulo + "\"" }),
        el("p", { text: (a.cliques_total || 0) + " no total. O mesmo aparelho conta uma vez por hora." }),
        (lista || []).length ? el("div", { class: "gestor-lista" }, lista.map(function (c) {
          return el("div", { class: "gestor-linha" }, [el("div", { class: "gestor-info" }, [el("strong", { text: nomes[c.perfil_id] || "(perfil excluído)" })]), el("strong", { text: String(c.cliques) })]);
        })) : el("p", { class: "sub", text: "Nenhum clique ainda." }),
        el("div", { class: "modal-botoes" }, [el("button", { class: "btn primario", type: "button", text: "Fechar", onclick: function () { m.fechar(); } })])
      ]);
    }).catch(falhou);
  }
  function cartaoAvisos() {
    var lista = el("div", { class: "gestor-lista" });
    if (!estado.avisos.length) lista.appendChild(el("p", { class: "sub", text: "Nenhum link ou aviso ainda." }));
    estado.avisos.forEach(function (a) {
      var st = estadoAviso(a), regras = [];
      if (a.fim) regras.push("até " + dataHoraBR(a.fim));
      if (a.max_cliques_perfil) regras.push("máx. " + a.max_cliques_perfil + " por perfil");
      if (a.max_cliques_total) regras.push("máx. " + a.max_cliques_total + " no total");
      var link = a.tipo !== "aviso";
      lista.appendChild(el("div", { class: "gestor-linha" + (st.ativo ? "" : " desligado") }, [
        el("span", { class: "gestor-icone" }, [icone(a.icone || "fa-solid fa-link")]),
        el("div", { class: "gestor-info" }, [
          el("strong", {}, [a.titulo, a.patrocinado ? el("span", { class: "selo neutro", style: "margin-left:6px", text: "Patrocinado" }) : null]),
          el("small", { text: (link ? "Link" : "Aviso") + " · " + (ONDE_NOMES[a.onde] || ONDE_NOMES.painel) + " · " + descreverAlvo(a) }),
          el("small", { class: "gestor-situacao" + (st.ativo ? " ativo" : ""), text: st.texto + (link ? " · " + (a.cliques_total || 0) + ((a.cliques_total || 0) === 1 ? " clique" : " cliques") : "") + (regras.length ? " · " + regras.join(" · ") : "") })
        ]),
        el("div", { class: "gestor-acoes" }, [
          el("button", { class: "btn pequeno", type: "button", onclick: function () { formularioAviso(a); } }, [icone("fa-solid fa-pen"), " Editar"]),
          link && a.cliques_total ? el("button", { class: "btn pequeno", type: "button", onclick: function () { verCliques(a); } }, [icone("fa-solid fa-chart-simple"), " Cliques"]) : null,
          el("button", { class: "btn pequeno", type: "button", onclick: function () {
            DB.salvarAviso(a.id, Object.assign({}, a, { ativo: !a.ativo })).then(function () { toast(a.ativo ? "Desligado." : "Ligado. ✅"); carregarGestor(); }).catch(falhou);
          } }, [icone(a.ativo ? "fa-solid fa-toggle-on" : "fa-solid fa-toggle-off"), a.ativo ? " Desligar" : " Ligar"]),
          el("button", { class: "btn pequeno icone perigo-leve", type: "button", title: "Excluir", "aria-label": "Excluir " + a.titulo, onclick: function () {
            confirmar({ titulo: "Excluir \"" + a.titulo + "\"?", texto: "Some dos painéis e das páginas, e a contagem de cliques é apagada.", botao: "Excluir", classe: "perigo" }).then(function (sim) {
              if (sim) return DB.excluirAviso(a.id).then(function () { toast("Excluído."); carregarGestor(); });
            }).catch(falhou);
          } }, [icone("fa-solid fa-trash-can")])
        ])
      ]));
    });
    return cartao("fa-solid fa-bullhorn", "Links e avisos", [
      el("p", { class: "sub", style: "margin:-6px 0 14px", text: "Aparecem no painel em que o cliente edita a página (ex.: \"Chame o Suporte\"), na página do perfil para os visitantes (ex.: uma promoção) ou nos dois. Podem sair do ar sozinhos por data ou por número de cliques." }),
      el("button", { class: "btn primario", type: "button", style: "margin-bottom:14px", onclick: function () { formularioAviso(null); } }, [icone("fa-solid fa-plus"), " Novo link ou aviso"]),
      lista
    ]);
  }

  function formularioAviso(a) {
    var v = Object.assign({ tipo: "link", titulo: "", texto: "", url: "", icone: DB.ICONES_AVISO[0], onde: "painel", patrocinado: false, alvo: "todos",
      segmentos: [], especialidades: [], perfis: [], inicio: null, fim: null, max_cliques_perfil: null, max_cliques_total: null, ativo: true }, a || {});
    function lista(opcoes, valor) {
      var s = el("select");
      opcoes.forEach(function (o) { s.appendChild(el("option", { value: o[0], text: o[1] })); });
      s.value = valor;
      return s;
    }
    var tipo = lista([["link", "Link (botão)"], ["aviso", "Aviso (mensagem)"]], v.tipo);
    var titulo = el("input", { type: "text", maxlength: "60", placeholder: "Ex.: Chame o Suporte" });
    titulo.value = v.titulo;
    var url = el("input", { type: "text", placeholder: "https://... ou o WhatsApp com DDD" });
    url.value = v.url || "";
    var texto = el("textarea", { maxlength: "300", placeholder: "Opcional no link; a mensagem, no aviso" });
    texto.value = v.texto || "";
    var iconeSel = lista(DB.ICONES_AVISO.map(function (i) { return [i, ICONES_NOMES[i] || i]; }), v.icone || DB.ICONES_AVISO[0]);
    var onde = lista([["painel", "No painel do cliente (para o dono do perfil)"], ["pagina", "Na página do perfil (para os visitantes)"], ["ambos", "Nos dois"]], v.onde || "painel");
    var patro = el("input", { type: "checkbox" });
    patro.checked = !!v.patrocinado;
    var campoPatro = el("label", { class: "gestor-marcar" }, [patro, "Mostrar a etiqueta \"Patrocinado\" na página"]);
    var alvoSel = lista([["todos", "Todos os perfis"], ["segmentos", "Só alguns segmentos"], ["perfis", "Só alguns perfis"]], v.alvo);
    function caixas(itens, marcadosIni) {
      return el("div", { class: "gestor-caixas" }, itens.map(function (it) {
        var c = el("input", { type: "checkbox", value: it.id });
        c.checked = marcadosIni.indexOf(it.id) >= 0;
        return el("label", { class: "gestor-marcar" }, [c, it.nome]);
      }));
    }
    function marcados(caixa) { return [].slice.call(caixa.querySelectorAll("input:checked")).map(function (c) { return c.value; }); }
    var segs = caixas(estado.segmentos.map(function (s) { return { id: s.id, nome: s.nome }; }), v.segmentos || []);
    // Especialidades dos segmentos marcados: refinam o público (opcional)
    var espMarcadas = (v.especialidades || []).slice(), caixaEsp = el("div");
    function desenharEspAlvo() {
      var segIds = marcados(segs), possiveis = estado.especialidades.filter(function (e) { return segIds.indexOf(e.segmento_id) >= 0; });
      espMarcadas = espMarcadas.filter(function (id) { return possiveis.some(function (e) { return e.id === id; }); });
      caixaEsp.innerHTML = "";
      if (!possiveis.length) return;
      caixaEsp.appendChild(el("div", { class: "dica", text: "Refinar por especialidade (opcional): marcando alguma, vale só para os perfis que tenham pelo menos uma delas." }));
      caixaEsp.appendChild(el("div", { class: "esp-chips" }, possiveis.map(function (e) {
        var c = el("input", { type: "checkbox" });
        c.checked = espMarcadas.indexOf(e.id) >= 0;
        var rot = el("label", { class: "esp-chip" + (c.checked ? " marcado" : "") }, [c, e.nome]);
        c.addEventListener("change", function () {
          rot.classList.toggle("marcado", c.checked);
          espMarcadas = espMarcadas.filter(function (x) { return x !== e.id; });
          if (c.checked) espMarcadas.push(e.id);
        });
        return rot;
      })));
    }
    segs.addEventListener("change", desenharEspAlvo);
    desenharEspAlvo();
    var perfs = caixas(estado.perfis.map(function (p) { return { id: p.id, nome: nomeDe(p) + " (/" + p.slug + ")" }; }), v.perfis || []);
    function marcarTodos(sim) { [].forEach.call(perfs.querySelectorAll("input"), function (c) { c.checked = sim; }); }
    var inicio = el("input", { type: "datetime-local" });
    inicio.value = paraCampoData(v.inicio);
    var fim = el("input", { type: "datetime-local" });
    fim.value = paraCampoData(v.fim);
    var maxPerfil = el("input", { type: "number", min: "1", step: "1", inputmode: "numeric", placeholder: "Sem limite" });
    maxPerfil.value = v.max_cliques_perfil || "";
    var maxTotal = el("input", { type: "number", min: "1", step: "1", inputmode: "numeric", placeholder: "Sem limite" });
    maxTotal.value = v.max_cliques_total || "";
    var ligado = el("input", { type: "checkbox" });
    ligado.checked = v.ativo !== false;

    var campoUrl = el("label", {}, ["Endereço", url, el("div", { class: "dica", text: "Link (https://...), e-mail (mailto:...) ou só o número do WhatsApp com DDD." })]);
    var campoSegs = el("div", {}, [estado.segmentos.length ? segs : el("p", { class: "sub", text: "Cadastre segmentos primeiro, no cartão \"Segmentos\"." }), caixaEsp]);
    var campoPerfs = el("div", {}, [
      el("div", { class: "gestor-marcar-todos" }, [
        el("button", { class: "btn pequeno", type: "button", text: "Marcar todos", onclick: function () { marcarTodos(true); } }),
        el("button", { class: "btn pequeno", type: "button", text: "Desmarcar todos", onclick: function () { marcarTodos(false); } })
      ]), perfs]);
    var campoCliques = el("div", { class: "grade" }, [el("label", {}, ["Máx. de cliques por perfil", maxPerfil]), el("label", {}, ["Máx. de cliques no total", maxTotal])]);
    function atualizar() {
      campoUrl.hidden = campoCliques.hidden = tipo.value === "aviso";
      campoPatro.hidden = onde.value === "painel";
      campoSegs.hidden = alvoSel.value !== "segmentos";
      campoPerfs.hidden = alvoSel.value !== "perfis";
    }
    [tipo, alvoSel, onde].forEach(function (x) { x.addEventListener("change", atualizar); });
    atualizar();
    var m;
    function salvarAviso() {
      DB.salvarAviso(a && a.id, {
        tipo: tipo.value, titulo: titulo.value, texto: texto.value, url: url.value, icone: iconeSel.value,
        onde: onde.value, patrocinado: patro.checked, alvo: alvoSel.value, segmentos: marcados(segs), especialidades: espMarcadas, perfis: marcados(perfs),
        inicio: deCampoData(inicio.value), fim: deCampoData(fim.value), max_cliques_perfil: maxPerfil.value, max_cliques_total: maxTotal.value,
        ativo: ligado.checked
      }).then(function () { m.fechar(); toast("Salvo! ✅"); carregarGestor(); }).catch(falhou);
    }
    m = abrirModal([
      el("h2", { text: a ? "Editar link ou aviso" : "Novo link ou aviso" }),
      el("label", {}, ["Tipo", tipo]),
      el("label", {}, ["Título", titulo]),
      campoUrl,
      el("label", {}, ["Texto", texto]),
      el("label", {}, ["Ícone", iconeSel]),
      el("label", {}, ["Onde aparece", onde]),
      campoPatro,
      el("label", {}, ["Para quem", alvoSel]),
      campoSegs, campoPerfs,
      el("div", { class: "gestor-regras" }, [
        el("strong", { text: "Quando sai do ar" }),
        el("div", { class: "dica", text: "Sai do ar na primeira regra atingida. Deixe em branco o que não quiser usar. O limite por perfil tira só daquele perfil." }),
        el("div", { class: "grade" }, [el("label", {}, ["Começa em (opcional)", inicio]), el("label", {}, ["Termina em", fim])]),
        campoCliques
      ]),
      el("label", { class: "gestor-marcar" }, [ligado, "Ligado"]),
      el("div", { class: "modal-botoes" }, [
        el("button", { class: "btn", type: "button", text: "Cancelar", onclick: function () { m.fechar(); } }),
        el("button", { class: "btn primario", type: "button", text: "Salvar", onclick: salvarAviso })
      ])
    ]);
    m.caixa.classList.add("modal-largo");   // formulário longo, com campos de data e hora
  }

  function mostrarClientes() {
    mostrarTela("telaClientes");
    document.title = "Clientes · Painel";
    $("listaClientes").innerHTML = "";
    $("listaClientes").appendChild(el("div", { class: "vazio", text: "Carregando…" }));
    DB.listarClientes().then(function (lista) {
      estado.clientes = lista || [];
      desenharClientes();
    }).catch(falhou);
  }

  function desenharClientes() {
    var todos = estado.clientes, alvo = $("listaClientes");
    var comPerfil = todos.filter(function (c) { return c.total_perfis > 0; }).length;
    $("resumoClientes").textContent = todos.length + (todos.length === 1 ? " cliente" : " clientes") + " · " + comPerfil + " com perfil";
    var b = estado.buscaClientes.trim().toLowerCase(), bd = DB.soDigitos(b);
    var vis = todos.filter(function (c) {
      if (!b) return true;
      var txt = [c.nome, c.email, c.cidade, c.uf, c.plano].join(" ").toLowerCase();
      var nums = [c.documento, c.telefone, c.whatsapp].join(" ");
      return txt.indexOf(b) >= 0 || (bd.length >= 3 && nums.indexOf(bd) >= 0);
    });
    alvo.innerHTML = "";
    if (!todos.length) {
      alvo.appendChild(el("div", { class: "vazio" }, [icone("fa-solid fa-users"), "Nenhum cliente ainda. Clique em \"Novo cliente\" para cadastrar o primeiro."]));
      return;
    }
    if (!vis.length) { alvo.appendChild(el("div", { class: "vazio", text: "Nenhum cliente encontrado com essa busca." })); return; }
    vis.forEach(function (c) {
      var meta = [];
      if (c.whatsapp || c.telefone) meta.push(el("span", {}, [icone(c.whatsapp ? "fa-brands fa-whatsapp" : "fa-solid fa-phone"), " " + fmtTel(c.whatsapp || c.telefone)]));
      if (c.email) meta.push(el("span", {}, [icone("fa-regular fa-envelope"), " " + c.email]));
      if (cidadeUF(c)) meta.push(el("span", {}, [icone("fa-solid fa-location-dot"), " " + cidadeUF(c)]));
      if (c.plano || c.valor_mensal != null) meta.push(el("span", {}, [icone("fa-regular fa-credit-card"), " " + [c.plano, c.valor_mensal != null ? "R$ " + fmtValor(c.valor_mensal) : ""].filter(Boolean).join(" · ")]));
      var iniciais = c.nome.replace(/\(.*?\)/g, "").trim().split(/\s+/).map(function (x) { return x[0]; }).slice(0, 2).join("").toUpperCase();
      // Foto do perfil ligado ao cliente; sem foto (ou se ela não carregar), as iniciais
      var bolinha = el("div", { class: "item-foto iniciais", text: iniciais });
      if (/^(https:\/\/|data:image\/)/.test(c.foto_perfil || "")) {
        var img = el("img", { class: "item-foto", src: c.foto_perfil, alt: "" }), so = bolinha;
        img.addEventListener("error", function () { if (img.parentNode) img.parentNode.replaceChild(so, img); });
        bolinha = img;
      }
      alvo.appendChild(el("div", { class: "item" }, [
        bolinha,
        el("div", { class: "item-info" }, [
          el("div", { class: "item-nome" }, [c.nome, el("span", { class: "selo neutro", text: c.total_perfis + (c.total_perfis === 1 ? " perfil" : " perfis") })]),
          el("div", { class: "item-meta" }, meta)
        ]),
        el("div", { class: "item-acoes" }, [
          el("a", { class: "btn pequeno", href: "#/cliente/" + c.id }, [icone("fa-solid fa-pen"), " Editar"]),
          el("button", { class: "btn pequeno", type: "button", onclick: function () { novoPerfil(c.id); } }, [icone("fa-solid fa-plus"), " Perfil"]),
          el("button", { class: "btn pequeno icone perigo-leve", type: "button", title: "Excluir", "aria-label": "Excluir " + c.nome, onclick: function () {
            excluirCliente(c).then(function (ok) { if (ok) mostrarClientes(); });
          } }, [icone("fa-solid fa-trash-can")])
        ])
      ]));
    });
  }
  $("buscaClientes").addEventListener("input", function () { estado.buscaClientes = this.value; desenharClientes(); });

  function excluirCliente(c) {
    var n = c.total_perfis || 0;
    return confirmar({
      titulo: "Excluir o cliente " + c.nome + "?",
      texto: "Apaga o cadastro (contato, endereço, redes e observações). " +
        (n ? (n === 1 ? "O perfil dele não é apagado: só fica sem cliente ligado." : "Os " + n + " perfis dele não são apagados: só ficam sem cliente ligado.") : "Ele não tem perfis."),
      alerta: "Não dá para desfazer.", botao: "Excluir cliente", classe: "perigo"
    }).then(function (sim) {
      if (!sim) return false;
      return DB.excluirCliente(c.id).then(function () { toast("Cliente excluído."); return true; });
    }).catch(function (e) { falhou(e); return false; });
  }

  // ---------------------------------------------------------------------------
  // Cadastro do cliente
  // ---------------------------------------------------------------------------
  function clienteParaForm(c) {
    c = c || {};
    var redes = {};
    DB.REDES_CLIENTE.forEach(function (k) { redes[k] = (c.redes && c.redes[k]) || ""; });
    return {
      nome: c.nome || "", tipo_pessoa: c.tipo_pessoa || "fisica", documento: c.documento ? fmtDoc(c.documento) : "",
      nascimento: c.nascimento || "", email: c.email || "", telefone: c.telefone ? fmtTel(c.telefone) : "",
      whatsapp: c.whatsapp ? fmtTel(c.whatsapp) : "", cep: c.cep ? fmtCep(c.cep) : "", logradouro: c.logradouro || "",
      numero: c.numero || "", complemento: c.complemento || "", bairro: c.bairro || "", cidade: c.cidade || "", uf: c.uf || "",
      redes: redes, plano: c.plano || "", valor_mensal: fmtValor(c.valor_mensal), observacoes: c.observacoes || "",
      sem_divulgacao: !!c.sem_divulgacao
    };
  }

  function abrirCliente(id) {
    mostrarTela("telaCliente");
    $("formCliente").innerHTML = "";
    $("clTitulo").textContent = "Carregando…";
    var novo = id === "novo";
    Promise.all([novo ? Promise.resolve(null) : DB.obterCliente(id), novo ? Promise.resolve([]) : DB.listar()]).then(function (res) {
      if (!novo && !res[0]) { toast("Cliente não encontrado.", true); location.hash = "#/clientes"; return; }
      var c = clienteParaForm(res[0]);
      estado.cl = { id: novo ? null : id, c: c, orig: JSON.stringify(c), rota: "#/cliente/" + id, sujo: false,
        perfis: (res[1] || []).filter(function (p) { return p.cliente_id === id; }) };
      desenharCliente();
    }).catch(falhou);
  }

  function marcarClienteSujo() {
    var cl = estado.cl;
    if (!cl) return;
    cl.sujo = JSON.stringify(cl.c) !== cl.orig;
    $("clSalvo").textContent = cl.sujo ? "Alterações não salvas" : (cl.id ? "Tudo salvo" : "");
    $("clSalvo").className = "salvo" + (cl.sujo ? " pendente" : "");
  }

  function desenharCliente() {
    var cl = estado.cl, c = cl.c, form = $("formCliente");
    form.innerHTML = "";
    $("clTitulo").textContent = cl.id ? c.nome || "Cliente" : "Novo cliente";
    document.title = (cl.id ? c.nome : "Novo cliente") + " · Painel";
    var campos = {};

    // campo(chave, rótulo, opções): input ligado a c[chave] (ou c.redes[chave] com rede: true)
    // v1.7.3: links e avisos marcados "na página do perfil" não aparecem nas páginas deste cliente
    function campoSemDivulgacao() {
      var chk = el("input", { type: "checkbox" });
      chk.checked = !!c.sem_divulgacao;
      chk.addEventListener("change", function () { c.sem_divulgacao = chk.checked; marcarClienteSujo(); });
      return el("label", { class: "gestor-marcar todo" }, [chk, "Não exibir divulgação nas páginas deste cliente (links e avisos do Gestor marcados para a página do perfil)"]);
    }
    function campo(chave, rotulo, o) {
      o = o || {};
      var alvo = o.rede ? c.redes : c;
      var input = el(o.multilinha ? "textarea" : "input", {
        type: o.multilinha ? null : (o.tipo || "text"), placeholder: o.ph || "", maxlength: o.max || null,
        inputmode: o.inputmode || null, autocomplete: o.autocomplete || "off", id: "cl-" + chave
      });
      input.value = alvo[chave] || "";
      input.addEventListener("input", function () {
        if (o.mascara) { var f = o.mascara(input.value); if (f !== input.value) input.value = f; }
        alvo[chave] = input.value;
        input.classList.remove("invalido");
        if (o.aoMudar) o.aoMudar(input.value);
        marcarClienteSujo();
      });
      campos[chave] = input;
      var rot = o.icone ? [icone(o.icone), " " + rotulo] : [rotulo];
      return el("label", { class: o.classe || null, for: "cl-" + chave }, rot.concat([input, o.dica ? el("div", { class: "dica", text: o.dica }) : null]));
    }

    // --- Dados ---
    var tipo = el("div", { class: "segmentado" });
    var rotDoc = el("span"), rotNasc = el("span"), rotNome = el("span");
    function rotulosTipo() {
      var pj = c.tipo_pessoa === "juridica";
      rotDoc.textContent = pj ? "CNPJ" : "CPF";
      rotNasc.textContent = pj ? "Data de fundação" : "Data de nascimento";
      rotNome.textContent = pj ? "Razão social ou nome fantasia" : "Nome completo";
      if (campos.documento) campos.documento.placeholder = pj ? "00.000.000/0000-00" : "000.000.000-00";
    }
    [["fisica", "Pessoa física"], ["juridica", "Pessoa jurídica"]].forEach(function (t) {
      tipo.appendChild(el("button", { type: "button", class: c.tipo_pessoa === t[0] ? "sel" : null, onclick: function () {
        c.tipo_pessoa = t[0];
        Array.prototype.forEach.call(tipo.children, function (b) { b.classList.remove("sel"); });
        this.classList.add("sel");
        rotulosTipo(); marcarClienteSujo();
      } }, [t[1]]));
    });
    var lNome = campo("nome", "", { max: 120, classe: "todo", aoMudar: function (v) { $("clTitulo").textContent = v || (cl.id ? "Cliente" : "Novo cliente"); } });
    lNome.insertBefore(rotNome, lNome.firstChild);
    var lDoc = campo("documento", "", { mascara: fmtDoc, inputmode: "numeric", max: 18 });
    lDoc.insertBefore(rotDoc, lDoc.firstChild);
    var lNasc = campo("nascimento", "", { tipo: "date" });
    lNasc.insertBefore(rotNasc, lNasc.firstChild);
    rotulosTipo();
    form.appendChild(cartao("fa-regular fa-address-card", "Dados do cliente", [
      el("div", { class: "grade" }, [el("div", { class: "todo" }, [tipo]), lNome, lDoc, lNasc])
    ]));

    // --- Contato ---
    form.appendChild(cartao("fa-solid fa-phone", "Contato", [
      el("div", { class: "grade" }, [
        campo("whatsapp", "WhatsApp", { mascara: fmtTel, inputmode: "tel", ph: "(11) 99999-9999", icone: "fa-brands fa-whatsapp" }),
        campo("telefone", "Telefone", { mascara: fmtTel, inputmode: "tel", ph: "(11) 3333-4444", icone: "fa-solid fa-phone" }),
        campo("email", "E-mail", { tipo: "email", ph: "cliente@exemplo.com", classe: "todo", icone: "fa-regular fa-envelope", inputmode: "email" })
      ])
    ]));

    // --- Endereço (CEP preenche o resto) ---
    var dicaCep = el("div", { class: "dica" });
    var ultimoCep = DB.soDigitos(c.cep);
    function buscarCep(v) {
      var d = DB.soDigitos(v);
      if (d.length !== 8 || d === ultimoCep) return;
      ultimoCep = d;
      dicaCep.textContent = "Buscando endereço…";
      fetch("https://viacep.com.br/ws/" + d + "/json/").then(function (r) { return r.json(); }).then(function (e) {
        if (!estado.cl || estado.cl.c !== c) return;
        if (e.erro) { dicaCep.textContent = "CEP não encontrado. Preencha o endereço à mão."; return; }
        [["logradouro", e.logradouro], ["bairro", e.bairro], ["cidade", e.localidade], ["uf", e.uf]].forEach(function (x) {
          if (!x[1]) return;
          c[x[0]] = x[1];
          if (campos[x[0]]) campos[x[0]].value = x[1];
        });
        dicaCep.textContent = "Endereço preenchido pelo CEP. Confira e complete o número.";
        marcarClienteSujo();
        if (campos.numero && !c.numero) campos.numero.focus();
      }).catch(function () { dicaCep.textContent = "Não foi possível buscar o CEP agora. Preencha o endereço à mão."; });
    }
    var lCep = campo("cep", "CEP", { mascara: fmtCep, inputmode: "numeric", ph: "00000-000", max: 9, aoMudar: buscarCep });
    lCep.appendChild(dicaCep);
    var selUf = el("select", { id: "cl-uf" });
    selUf.appendChild(el("option", { value: "", text: "—" }));
    DB.UFS.forEach(function (u) { selUf.appendChild(el("option", { value: u, text: u })); });
    selUf.value = c.uf || "";
    selUf.addEventListener("change", function () { c.uf = selUf.value; selUf.classList.remove("invalido"); marcarClienteSujo(); });
    campos.uf = { focus: function () { selUf.focus(); }, classList: selUf.classList, set value(v) { selUf.value = v; } };
    form.appendChild(cartao("fa-solid fa-location-dot", "Endereço", [
      el("div", { class: "grade endereco" }, [
        lCep,
        campo("logradouro", "Rua / Avenida", { classe: "todo" }),
        campo("numero", "Número", { max: 20 }),
        campo("complemento", "Complemento", { ph: "Sala, apto, bloco..." }),
        campo("bairro", "Bairro"),
        campo("cidade", "Cidade"),
        el("label", { for: "cl-uf" }, ["UF", selUf])
      ])
    ]));

    // --- Redes sociais ---
    form.appendChild(cartao("fa-solid fa-hashtag", "Redes sociais", [
      el("p", { class: "sub", style: "margin:-6px 0 14px", text: "Use só o @usuario (sem o @) ou o link. Dá para trazer tudo para a página do perfil depois." }),
      el("div", { class: "grade" }, DB.REDES_CLIENTE.map(function (k) {
        var t = TEXTO_REDES[k];
        return campo(k, t[0], { rede: true, ph: t[2], icone: t[1], tipo: k === "site" ? "url" : "text" });
      }))
    ]));

    // --- Plano ---
    var lista = el("datalist", { id: "planos" }, ["Mensal", "Trimestral", "Semestral", "Anual", "Pagamento único"].map(function (x) { return el("option", { value: x }); }));
    var lPlano = campo("plano", "Plano", { ph: "Mensal, Anual..." });
    lPlano.querySelector("input").setAttribute("list", "planos");
    form.appendChild(cartao("fa-regular fa-credit-card", "Plano e observações", [
      el("div", { class: "grade" }, [
        lPlano, lista,
        campo("valor_mensal", "Valor (R$)", { inputmode: "decimal", ph: "19,90", mascara: function (v) { return v.replace(/[^\d,.]/g, ""); } }),
        campo("observacoes", "Observações", { multilinha: true, classe: "todo", ph: "Forma de pagamento, preferências, combinados..." }),
        campoSemDivulgacao()
      ])
    ]));

    // --- Perfis do cliente ---
    if (cl.id) {
      var itens = cl.perfis.map(function (p) {
        return el("div", { class: "perfil-do-cliente" }, [
          el("a", { href: "#/perfil/" + p.id }, [nomeDe(p)]), seloPerfil(p),
          el("span", { class: "sub", text: "/" + p.slug })
        ]);
      });
      form.appendChild(cartao("fa-solid fa-id-card", "Perfis deste cliente", [
        itens.length ? el("div", { class: "perfis-do-cliente" }, itens) : el("p", { class: "sub", text: "Nenhum perfil ainda." }),
        el("button", { class: "btn", type: "button", style: "margin-top:12px", onclick: function () {
          var ir = function () { novoPerfil(cl.id); };
          if (cl.sujo) salvarCliente().then(function (ok) { if (ok) ir(); }); else ir();
        } }, [icone("fa-solid fa-plus"), " Criar perfil para este cliente"])
      ]));
      form.appendChild(cartao("fa-solid fa-triangle-exclamation", "Excluir cliente", [
        el("p", { class: "sub", style: "margin:-6px 0 14px", text: "Apaga o cadastro. Os perfis dele não são apagados: só ficam sem cliente ligado." }),
        el("button", { class: "btn perigo", type: "button", onclick: function () {
          excluirCliente({ id: cl.id, nome: c.nome, total_perfis: cl.perfis.length }).then(function (ok) {
            if (!ok) return;
            estado.cl = null;
            location.hash = "#/clientes";
          });
        } }, [icone("fa-solid fa-trash-can"), " Excluir cliente"])
      ]));
    }

    form.onsubmit = function (e) { e.preventDefault(); salvarCliente(); };
    cl.campos = campos;
    marcarClienteSujo();
    if (!cl.id) setTimeout(function () { campos.nome.focus(); }, 30);
  }

  function salvarCliente() {
    var cl = estado.cl;
    if (!cl) return Promise.resolve(false);
    if (cl.salvando) return cl.salvando;               // evita criar o mesmo cliente duas vezes
    try { DB.validarCliente(cl.c); }
    catch (e) {
      toast(e.message, true);
      var f = e.campo && cl.campos[e.campo];
      if (f) { f.classList.add("invalido"); f.focus(); }
      return Promise.resolve(false);
    }
    var btn = $("btnSalvarCliente");
    btn.disabled = true;
    var acao = cl.id ? DB.salvarCliente(cl.id, cl.c) : DB.criarCliente(cl.c);
    cl.salvando = acao.then(function (r) {
      if (estado.cl !== cl) return true;
      var eraNovo = !cl.id;
      cl.id = r.id;
      cl.c = clienteParaForm(r);
      cl.orig = JSON.stringify(cl.c);
      cl.sujo = false;
      if (eraNovo) {
        cl.rota = "#/cliente/" + r.id;
        history.replaceState(null, "", cl.rota);
        hashAnterior = cl.rota;
      }
      desenharCliente();
      toast(eraNovo ? "Cliente cadastrado! ✅" : "Salvo! ✅");
      return true;
    }).catch(function (e) {
      falhou(e);
      var f = e.campo && cl.campos[e.campo];
      if (f) { f.classList.add("invalido"); f.focus(); }
      return false;
    }).then(function (ok) { btn.disabled = false; cl.salvando = null; return ok; });
    return cl.salvando;
  }
  $("btnSalvarCliente").addEventListener("click", function () { salvarCliente(); });

  // ===========================================================================
  // Início
  // ===========================================================================
  $("nomeMarca").textContent = (cfg.marca || "Painel") + " · Painel";
  if (DB.demo) $("faixaDemo").hidden = false;
  DB.sessao().then(function (u) { if (u) entrarNoApp(u); else mostrarLogin(); }).catch(mostrarLogin);
})();
