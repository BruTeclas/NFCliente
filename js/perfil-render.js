/*
 * Desenha a página de um perfil. Usado pela página pública (perfil.html)
 * e pela prévia ao vivo do painel (admin/).
 *
 * Formato de "dados" de um perfil:
 * {
 *   nome, descricao, foto, capa, cor, tema: "escuro" | "claro",
 *   links: [ { id, tipo, ...campos do tipo, titulo? } ],
 *   mostrarSalvarContato, mostrarCompartilhar
 * }
 */
(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Tipos de link. Na página, os DESTAQUES primeiros links válidos da lista viram
  // ícones redondos abaixo da descrição; os demais viram botões, na mesma ordem.
  // "grupo" só organiza o menu "Adicionar" do painel.
  // ---------------------------------------------------------------------------
  var DESTAQUES = 2;
  function perfilUrl(base) {
    return function (l) {
      var u = String(l.usuario || "").trim();
      if (!u) return "";
      if (/^https?:\/\//i.test(u)) return u;
      return base.replace("{u}", encodeURIComponent(u.replace(/^@/, "")));
    };
  }
  var CAMPO_USUARIO = [{ k: "usuario", rotulo: "Usuário ou link", ph: "usuario (sem @) ou https://..." }];
  function rede(nome, icone, base, cor, corIcone) {
    var href = perfilUrl(base);
    return {
      nome: nome, icone: icone, grupo: "rede", cor: cor, corIcone: corIcone, campos: CAMPO_USUARIO, href: href, falta: "o usuário ou o link",
      titulo: nome, sub: function (l) { return href(l).replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, ""); }
    };
  }

  var TIPOS = {
    whatsapp: {
      nome: "WhatsApp", icone: "fa-brands fa-whatsapp", grupo: "botao", cor: "#25d366",
      titulo: "Chamar no WhatsApp", sub: function () { return "Resposta rápida"; },
      falta: "o número com DDD",
      campos: [
        { k: "numero", rotulo: "Número com DDD", ph: "(11) 99999-9999", dica: "O 55 do Brasil entra sozinho." },
        { k: "mensagem", rotulo: "Mensagem pronta (opcional)", ph: "Olá! Vim pelo seu chaveiro..." }
      ],
      href: function (l) {
        var n = numeroInternacional(l.numero);
        if (!n) return "";
        return "https://wa.me/" + n + (l.mensagem ? "?text=" + encodeURIComponent(l.mensagem) : "");
      }
    },
    pix: {
      nome: "Pix", icone: "fa-brands fa-pix", grupo: "botao", cor: "#32bcad",
      titulo: "Pagar com Pix", sub: function () { return "QR Code e Copia e Cola"; }, falta: "a chave Pix",
      campos: [
        { k: "chave", rotulo: "Chave Pix", ph: "CPF, CNPJ, e-mail, +5511999999999 ou aleatória" },
        { k: "nome", rotulo: "Nome do recebedor", ph: "Como está no banco" },
        { k: "cidade", rotulo: "Cidade", ph: "Sao Paulo" },
        { k: "valor", rotulo: "Valor fixo (opcional)", ph: "25.00" }
      ],
      acao: function (l) { if (String(l.chave || "").trim()) return function () { abrirPix(l); }; }
    },
    google_avaliar: {
      nome: "Google – Avaliar", icone: "fa-brands fa-google", grupo: "botao", cor: "#4285f4",
      titulo: "Avalie no Google", sub: function () { return "Sua opinião ajuda muito ⭐"; },
      campos: [{ k: "url", rotulo: "Link de avaliação", ph: "https://g.page/r/.../review" }], falta: "o link de avaliação",
      href: function (l) { return comEsquema(l.url); }
    },
    maps: {
      nome: "Google Maps", icone: "fa-solid fa-location-dot", grupo: "botao", cor: "#ea4335",
      titulo: "Como chegar", sub: function () { return "Abrir no Google Maps"; },
      campos: [{ k: "url", rotulo: "Link do Maps", ph: "https://maps.app.goo.gl/..." }], falta: "o link do Maps",
      href: function (l) { return comEsquema(l.url); }
    },
    google_perfil: {
      nome: "Google – Perfil da Empresa", icone: "fa-brands fa-google", grupo: "botao", cor: "#4285f4",
      titulo: "Perfil no Google", sub: function () { return "Horários, fotos e mais"; },
      campos: [{ k: "url", rotulo: "Link do perfil", ph: "https://..." }], falta: "o link do perfil",
      href: function (l) { return comEsquema(l.url); }
    },
    email: {
      nome: "E-mail", icone: "fa-solid fa-envelope", grupo: "botao", cor: "#f59e0b",
      titulo: "Enviar e-mail", sub: function (l) { return l.email; },
      campos: [{ k: "email", rotulo: "E-mail", ph: "contato@exemplo.com" }], falta: "um e-mail válido",
      href: function (l) { var e = String(l.email || "").trim(); return e ? "mailto:" + e : ""; }
    },
    telefone: {
      nome: "Telefone", icone: "fa-solid fa-phone", grupo: "botao", cor: "#3b82f6",
      titulo: "Ligar", sub: function (l) { return l.numero; },
      campos: [{ k: "numero", rotulo: "Telefone com DDD", ph: "(11) 3333-4444" }], falta: "o número com DDD",
      href: function (l) {
        var bruto = String(l.numero || "").trim(), d = soDigitos(bruto);
        if (d.length < 3) return "";
        if (bruto.charAt(0) === "+") return "tel:+" + d;
        if (d.charAt(0) === "0") return "tel:" + d;                    // 0800, 0300...
        var n = numeroInternacional(d);
        return "tel:" + (n ? "+" + n : d);
      }
    },
    site: {
      nome: "Site", icone: "fa-solid fa-globe", grupo: "botao",
      titulo: "Site", sub: function (l) { return String(l.url || "").replace(/^https?:\/\//, ""); },
      campos: [{ k: "url", rotulo: "Endereço", ph: "www.exemplo.com.br" }], falta: "o endereço do site",
      href: function (l) { return comEsquema(l.url); }
    },
    link: {
      nome: "Link personalizado", icone: "fa-solid fa-link", grupo: "botao",
      titulo: "Link", sub: function (l) { return l.subtitulo || ""; },
      campos: [
        { k: "titulo", rotulo: "Texto do botão", ph: "Ver cardápio" },
        { k: "subtitulo", rotulo: "Texto menor (opcional)", ph: "Atualizado toda semana" },
        { k: "url", rotulo: "Link", ph: "www.exemplo.com.br/pagina" },
        { k: "icone", rotulo: "Ícone", tipo: "icone" }
      ],
      falta: "o link", href: function (l) { return comEsquema(l.url); }
    },
    instagram: rede("Instagram", "fa-brands fa-instagram", "https://instagram.com/{u}", "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)"),
    facebook:  rede("Facebook", "fa-brands fa-facebook-f", "https://facebook.com/{u}", "#1877f2"),
    tiktok:    rede("TikTok", "fa-brands fa-tiktok", "https://tiktok.com/@{u}", "#111111"),
    youtube:   rede("YouTube", "fa-brands fa-youtube", "https://youtube.com/@{u}", "#ff0000"),
    linkedin:  rede("LinkedIn", "fa-brands fa-linkedin-in", "https://linkedin.com/in/{u}", "#0a66c2"),
    x:         rede("X (Twitter)", "fa-brands fa-x-twitter", "https://x.com/{u}", "#111111"),
    threads:   rede("Threads", "fa-brands fa-threads", "https://threads.net/@{u}", "#111111"),
    kwai:      rede("Kwai", "fa-solid fa-video", "https://kwai.com/@{u}", "#ff6a00"),
    pinterest: rede("Pinterest", "fa-brands fa-pinterest-p", "https://pinterest.com/{u}", "#e60023"),
    telegram:  rede("Telegram", "fa-brands fa-telegram", "https://t.me/{u}", "#229ed9"),
    spotify:   rede("Spotify", "fa-brands fa-spotify", "https://open.spotify.com/user/{u}", "#1db954"),
    twitch:    rede("Twitch", "fa-brands fa-twitch", "https://twitch.tv/{u}", "#9146ff"),
    discord:   rede("Discord", "fa-brands fa-discord", "https://discord.gg/{u}", "#5865f2"),
    snapchat:  rede("Snapchat", "fa-brands fa-snapchat", "https://snapchat.com/add/{u}", "#fffc00", "#111111"),
    behance:   rede("Behance", "fa-brands fa-behance", "https://behance.net/{u}", "#1769ff"),
    github:    rede("GitHub", "fa-brands fa-github", "https://github.com/{u}", "#24292f")
  };

  // Ícones oferecidos no "Link personalizado"
  var ICONES = [
    ["fa-solid fa-link", "Link"], ["fa-solid fa-book-open", "Cardápio/Catálogo"],
    ["fa-solid fa-calendar-check", "Agenda"], ["fa-solid fa-cart-shopping", "Loja"],
    ["fa-solid fa-tags", "Preços"], ["fa-solid fa-images", "Portfólio"],
    ["fa-solid fa-ticket", "Cupom"], ["fa-solid fa-wifi", "Wi-Fi"],
    ["fa-solid fa-motorcycle", "Delivery"], ["fa-solid fa-file-pdf", "PDF"],
    ["fa-solid fa-play", "Vídeo"], ["fa-solid fa-star", "Destaque"],
    ["fa-solid fa-heart", "Coração"], ["fa-solid fa-paw", "Pet"],
    ["fa-solid fa-briefcase", "Trabalho"], ["fa-solid fa-gift", "Presente"]
  ];

  // ---------------------------------------------------------------------------
  // Utilitários
  // ---------------------------------------------------------------------------
  function soDigitos(s) { return String(s || "").replace(/\D/g, ""); }
  // Número com DDI: completa com 55 (Brasil) quando vier só DDD + número.
  function numeroInternacional(v) {
    var d = soDigitos(v).replace(/^0+/, "");
    if (d.length === 10 || d.length === 11) d = "55" + d;
    return d.length >= 12 && d.length <= 15 ? d : "";
  }
  // "www.site.com.br" -> "https://www.site.com.br"
  function comEsquema(u) {
    u = String(u || "").trim();
    if (u && !/^[a-z][a-z0-9+.-]*:/i.test(u) && /^[\w-]+(\.[\w-]+)+([\/?#].*)?$/.test(u)) return "https://" + u;
    return u;
  }
  function urlSegura(u) { u = String(u || "").trim(); return /^(https?:|mailto:|tel:)/i.test(u) ? u : ""; }
  function imgSegura(u) { u = String(u || ""); return /^(https?:|data:image\/|blob:)/i.test(u) || /^[\w./-]+$/.test(u) ? u : ""; }
  function semAcento(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 .,\-]/g, "").trim();
  }
  function el(tag, attrs, filhos) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    });
    (filhos || []).forEach(function (f) { if (f) e.appendChild(typeof f === "string" ? document.createTextNode(f) : f); });
    return e;
  }
  function icone(c) { return el("i", { class: c, "aria-hidden": "true" }); }

  function avisar(msg) {
    var t = document.getElementById("perfilToast");
    if (!t) { t = el("div", { id: "perfilToast", class: "perfil-toast" }); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add("ver");
    clearTimeout(avisar._t);
    avisar._t = setTimeout(function () { t.classList.remove("ver"); }, 2200);
  }
  function copiar(texto, msg) {
    function fallback() {
      var a = el("textarea", { readonly: "" });
      a.value = texto; a.style.position = "fixed"; a.style.opacity = "0";
      document.body.appendChild(a); a.select();
      try { document.execCommand("copy"); } catch (e) {}
      a.remove();
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(texto).catch(fallback);
    else fallback();
    avisar(msg || "Copiado!");
  }

  // ---------------------------------------------------------------------------
  // Pix "Copia e Cola" (BR Code estático, padrão do Banco Central)
  // ---------------------------------------------------------------------------
  function campo(id, v) { v = String(v); return id + String(v.length).padStart(2, "0") + v; }
  function crc16(s) {
    var crc = 0xFFFF;
    for (var i = 0; i < s.length; i++) {
      crc ^= s.charCodeAt(i) << 8;
      for (var j = 0; j < 8; j++) { crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1); crc &= 0xFFFF; }
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  }
  // Celular deve vir com +55 (ex.: +5511999999999). 11 dígitos = CPF, 14 = CNPJ.
  function normalizarChave(chave) {
    chave = String(chave || "").trim();
    if (chave.indexOf("@") < 0 && /^\+?[\d\s().\/-]{10,}$/.test(chave)) {
      var d = soDigitos(chave);
      if (chave.charAt(0) === "+") return "+" + d;
      if (d.length === 11 || d.length === 14) return d;
      return "+" + (d.indexOf("55") === 0 && d.length >= 12 ? d : "55" + d);
    }
    return chave;
  }
  function gerarPix(p) {
    var conta = campo("00", "br.gov.bcb.pix") + campo("01", normalizarChave(p.chave));
    var valor = Number(String(p.valor || "").replace(",", "."));
    var payload =
      campo("00", "01") +
      campo("26", conta) +
      campo("52", "0000") +
      campo("53", "986") +
      (valor > 0 ? campo("54", valor.toFixed(2)) : "") +
      campo("58", "BR") +
      campo("59", (semAcento(p.nome) || "Recebedor").slice(0, 25)) +
      campo("60", (semAcento(p.cidade) || "Brasil").slice(0, 15)) +
      campo("62", campo("05", "***")) +
      "6304";
    return payload + crc16(payload);
  }

  function abrirPix(p) {
    var codigo = gerarPix(p);
    var qr = el("div", { class: "perfil-qr" });
    var fundo;
    function fechar() { fundo.remove(); document.removeEventListener("keydown", esc); }
    function esc(e) { if (e.key === "Escape") fechar(); }
    fundo = el("div", { class: "perfil-modal", role: "dialog", "aria-modal": "true", onclick: function (e) { if (e.target === fundo) fechar(); } }, [
      el("div", { class: "perfil-modal-caixa" }, [
        el("h2", {}, [icone("fa-brands fa-pix"), " Pagar com Pix"]),
        p.nome ? el("p", { text: "Recebedor: " + p.nome }) : null,
        p.valor ? el("p", { text: "Valor: R$ " + Number(String(p.valor).replace(",", ".")).toFixed(2).replace(".", ",") }) : null,
        qr,
        el("div", { class: "perfil-chave", text: "Chave: " + p.chave }),
        el("button", { class: "perfil-botao principal", type: "button", onclick: function () { copiar(codigo, "Pix Copia e Cola copiado! Cole no app do banco."); } },
          [icone("fa-regular fa-copy"), " Copiar Pix Copia e Cola"]),
        el("button", { class: "perfil-botao", type: "button", onclick: function () { copiar(p.chave, "Chave Pix copiada!"); } },
          [icone("fa-solid fa-key"), " Copiar só a chave"]),
        el("button", { class: "perfil-fechar", type: "button", onclick: fechar, text: "Fechar" })
      ])
    ]);
    document.body.appendChild(fundo);
    document.addEventListener("keydown", esc);
    if (window.QRCode) new QRCode(qr, { text: codigo, width: 400, height: 400, correctLevel: QRCode.CorrectLevel.M });
    else qr.remove();
  }

  // ---------------------------------------------------------------------------
  // Salvar contato (.vcf)
  // ---------------------------------------------------------------------------
  function salvarContato(d) {
    function esc(s) { return String(s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n"); }
    var v = ["BEGIN:VCARD", "VERSION:3.0", "FN:" + esc(d.nome), "N:" + esc(d.nome) + ";;;;"];
    (d.links || []).forEach(function (l) {
      if (l.tipo === "telefone" && l.numero) v.push("TEL;TYPE=CELL:" + l.numero);
      if (l.tipo === "whatsapp" && l.numero) v.push("TEL;TYPE=CELL:+" + soDigitos(l.numero));
      if (l.tipo === "email" && l.email) v.push("EMAIL:" + l.email);
      if (l.tipo === "site" && l.url) v.push("URL:" + l.url);
    });
    v.push("URL:" + location.href);
    if (d.descricao) v.push("NOTE:" + esc(d.descricao));
    v.push("END:VCARD");
    var blob = new Blob([v.join("\r\n")], { type: "text/vcard;charset=utf-8" });
    var a = el("a", { href: URL.createObjectURL(blob), download: (semAcento(d.nome) || "contato") + ".vcf" });
    document.body.appendChild(a); a.click(); a.remove();
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  // Recusa endereços que são só o começo ("mailto:", "tel:+", "https://").
  function hrefCompleto(h) {
    if (/^mailto:/i.test(h)) return /^mailto:[^\s@]+@[^\s@]+$/i.test(h);
    if (/^tel:/i.test(h)) return /\d/.test(h);
    return /^https?:\/\/[^\/\s?#.]+\.[^\/\s?#]+/i.test(h);
  }
  // O que o link faz na página, ou null se estiver incompleto (e não aparece).
  function resolverLink(l) {
    var t = l && TIPOS[l.tipo];
    if (!t) return null;
    var href = t.href ? urlSegura(t.href(l)) : "";
    if (href && !hrefCompleto(href)) href = "";
    var acao = t.acao ? t.acao(l) : null;
    return href || acao ? { tipo: t, href: href, acao: acao || null } : null;
  }
  // Rodapé com o crédito (configurado em js/config.js).
  var CREDITO_PADRAO = { texto: "Desenvolvido por", nome: "FrontIA", url: "https://frontia.com.br/" };
  function rodapeCredito(classeExtra) {
    var cfg = window.CONFIG || {};
    var c = "credito" in cfg ? cfg.credito : CREDITO_PADRAO;
    if (!c || !c.nome) return null;
    var url = urlSegura(c.url);
    return el("footer", { class: "perfil-rodape" + (classeExtra ? " " + classeExtra : "") }, [
      c.texto ? c.texto + " " : null,
      url ? el("a", { href: url, target: "_blank", rel: "noopener", text: c.nome }) : el("strong", { text: c.nome })
    ]);
  }

  function oQueFalta(l) {
    var t = TIPOS[l && l.tipo];
    return t ? (t.falta || String(t.campos[0].rotulo).toLowerCase()) : "";
  }
  function tituloLink(l, t) {
    return String((l.tipo === "link" ? l.titulo : l.rotulo) || "").trim() || t.titulo || t.nome;
  }

  function render(alvo, d, opcoes) {
    d = d || {};
    opcoes = opcoes || {};
    var raiz = el("div", { class: "perfil" + (d.tema === "claro" ? " claro" : "") });
    raiz.style.setProperty("--cor", d.cor || "#7c3aed");
    var capa = imgSegura(d.capa);
    if (capa) {
      raiz.classList.add("com-capa");
      raiz.appendChild(el("div", { class: "perfil-capa", style: "background-image:url(\"" + capa.replace(/"/g, "%22") + "\")" }));
    }

    var main = el("main", { class: "perfil-conteudo" });
    var foto = imgSegura(d.foto);
    main.appendChild(el("header", { class: "perfil-topo" }, [
      foto ? el("img", { class: "perfil-avatar", src: foto, alt: "Foto de " + (d.nome || "") }) : null,
      el("h1", { text: d.nome || "" }),
      d.descricao ? el("p", { class: "perfil-descricao", text: d.descricao }) : null
    ]));

    var destaques = el("nav", { class: "perfil-redes", "aria-label": "Destaques" });
    var botoes = el("section", { class: "perfil-botoes" });
    var emDestaque = 0;

    (d.links || []).forEach(function (l) {
      var r = resolverLink(l);
      if (!r) {
        // Na prévia do painel, o link incompleto aparece tracejado dizendo o que falta.
        var ti = TIPOS[l.tipo];
        if (opcoes.mostrarIncompletos && ti) {
          botoes.appendChild(el("div", { class: "perfil-botao incompleto", "aria-hidden": "true" }, [
            el("span", { class: "ic" }, [icone(l.tipo === "link" && l.icone ? l.icone : ti.icone)]),
            el("span", { class: "tx" }, [tituloLink(l, ti), el("small", { text: "Falta " + oQueFalta(l) + " · não aparece na página" })])
          ]));
        }
        return;
      }
      var t = r.tipo, href = r.href, acao = r.acao;
      var externo = /^https?:/i.test(href);
      var nomeIcone = l.tipo === "link" && l.icone ? l.icone : t.icone;
      var titulo = tituloLink(l, t);
      var abrir = acao ? { type: "button", onclick: acao } : { href: href, target: externo ? "_blank" : null, rel: externo ? "noopener" : null };

      if (emDestaque < DESTAQUES) {
        emDestaque++;
        // Destaque nas cores do próprio aplicativo (sem cor própria: a cor da página); a borda fica na cor da página
        var bt = el(acao ? "button" : "a", Object.assign({ class: "perfil-rede destaque", "aria-label": titulo, title: titulo }, abrir), [icone(nomeIcone)]);
        if (t.cor) { bt.style.background = t.cor; bt.style.color = t.corIcone || "#fff"; }
        destaques.appendChild(bt);
        return;
      }
      var sub = t.sub ? t.sub(l) : "";
      var ic = el("span", { class: "ic" }, [icone(nomeIcone)]);
      if (t.cor) ic.style.background = t.cor;
      if (t.corIcone) ic.style.color = t.corIcone;
      botoes.appendChild(el(acao ? "button" : "a", Object.assign({ class: "perfil-botao" }, abrir), [
        ic, el("span", { class: "tx" }, [titulo, sub ? el("small", { text: sub }) : null]), icone("fa-solid fa-chevron-right seta")
      ]));
    });
    if (destaques.children.length) main.appendChild(destaques);
    var divulgacao = blocoDivulgacao(opcoes);
    if (divulgacao) main.appendChild(divulgacao);
    if (botoes.children.length) main.appendChild(botoes);

    var acoes = el("section", { class: "perfil-acoes" });
    if (d.mostrarSalvarContato !== false) {
      acoes.appendChild(el("button", { class: "perfil-botao", type: "button", onclick: function () { salvarContato(d); } },
        [icone("fa-solid fa-address-book"), " Salvar contato"]));
    }
    if (d.mostrarCompartilhar !== false) {
      acoes.appendChild(el("button", { class: "perfil-botao", type: "button", onclick: function () {
        var url = opcoes.urlPublica || location.href;
        if (navigator.share) navigator.share({ title: d.nome, url: url }).catch(function () {});
        else copiar(url, "Link copiado!");
      } }, [icone("fa-solid fa-share-nodes"), " Compartilhar"]));
    }
    if (acoes.children.length) main.appendChild(acoes);

    var rodape = rodapeCredito();
    if (rodape) main.appendChild(rodape);
    raiz.appendChild(main);

    alvo.innerHTML = "";
    alvo.appendChild(raiz);
    return raiz;
  }

  // Tela simples para "não encontrado", "desativado" etc.
  function renderAviso(alvo, icn, titulo, texto) {
    alvo.innerHTML = "";
    alvo.appendChild(el("div", { class: "perfil" }, [
      el("main", { class: "perfil-conteudo perfil-aviso" }, [
        el("div", { class: "perfil-aviso-ic" }, [icone(icn)]),
        el("h1", { text: titulo }),
        el("p", { class: "perfil-descricao", text: texto })
      ]),
      rodapeCredito("no-aviso")
    ]));
  }

  // Links e avisos do administrador na página pública (v1.7.3). Endereços só https, e-mail ou telefone;
  // textos sempre como texto puro.
  function blocoDivulgacao(opcoes) {
    var lista = (opcoes.avisos || []).filter(function (a) {
      return a && a.titulo && (a.tipo === "aviso" || /^(https:\/\/|mailto:|tel:)/i.test(String(a.url || "")));
    });
    if (!lista.length) return null;
    var bloco = el("section", { class: "perfil-divulgacao", "aria-label": "Divulgação" });
    lista.forEach(function (a) {
      var selo = a.patrocinado ? el("span", { class: "selo-patrocinado", text: "Patrocinado" }) : null;
      var ic = String(a.icone || "");
      if (!/^fa-(solid|brands|regular) fa-[a-z0-9-]+$/.test(ic)) ic = a.tipo === "aviso" ? "fa-solid fa-circle-info" : "fa-solid fa-link";
      if (a.tipo === "aviso") {
        bloco.appendChild(el("div", { class: "perfil-aviso-adm" }, [icone(ic),
          el("div", { class: "tx" }, [el("strong", { text: a.titulo }), selo, a.texto ? el("p", { text: a.texto }) : null])]));
        return;
      }
      var externo = /^https:/i.test(a.url);
      bloco.appendChild(el("a", {
        class: "perfil-botao perfil-botao-adm", href: a.url, target: externo ? "_blank" : null, rel: externo ? "noopener noreferrer" : null,
        onclick: function () { if (opcoes.aoClicarAviso) opcoes.aoClicarAviso(a); }
      }, [el("span", { class: "ic" }, [icone(ic)]), el("span", { class: "tx" }, [a.titulo, a.texto ? el("small", { text: a.texto }) : null]), selo]));
    });
    return bloco;
  }

  window.Perfil = {
    TIPOS: TIPOS, ICONES: ICONES, DESTAQUES: DESTAQUES, resolverLink: resolverLink, oQueFalta: oQueFalta,
    numeroInternacional: numeroInternacional,
    render: render, renderAviso: renderAviso,
    gerarPix: gerarPix, copiar: copiar, avisar: avisar, el: el, icone: icone
  };
})();
