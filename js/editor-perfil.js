/*
 * Editor da página do perfil: aparência, informações, links e botões extras.
 * Usado pelo painel (admin.nfcliente.com.br) e pela página do cliente (cliente.nfcliente.com.br),
 * para os dois editarem a página exatamente do mesmo jeito.
 *
 * EditorPerfil.montar(form, o) acrescenta os cartões em "form". "o" traz:
 *   dados          os dados da página (editados no lugar)
 *   marcarSujo()   chamado a cada alteração
 *   enviarImagem(blob, "foto"|"capa")  → Promise com o endereço da imagem enviada
 *   registrarImagem(url)  opcional: guarda as imagens enviadas nesta edição
 *   ativo()        opcional: false quando o editor já foi fechado (ignora envios atrasados)
 *   aoMudarNome()  opcional: o nome exibido mudou
 *   aoMudar        opcional: lista onde o editor registra funções a chamar em cada alteração
 *   falhou(erro)   mostra um erro
 */
(function () {
  "use strict";
  var el = Perfil.el, icone = Perfil.icone, TIPOS = Perfil.TIPOS;

  var CORES = ["#7c3aed", "#e11d74", "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#0ea5e9", "#2563eb", "#111827", "#a16207", "#be185d"];
  var GRUPOS_LINKS = [
    ["Principais", ["whatsapp", "pix", "telefone", "email", "site", "link"]],
    ["Google", ["google_avaliar", "maps", "google_perfil"]],
    ["Redes sociais", Object.keys(TIPOS).filter(function (k) { return TIPOS[k].grupo === "rede"; })]
  ];

  function uid() { return Math.random().toString(36).slice(2, 10); }

  function campoTexto(rotulo, valor, aoMudar, extra) {
    extra = extra || {};
    var input = el(extra.multilinha ? "textarea" : "input", {
      type: extra.multilinha ? null : (extra.tipo || "text"), placeholder: extra.ph || "", maxlength: extra.max || null
    });
    input.value = valor || "";
    input.addEventListener("input", function () { aoMudar(input.value); });
    return el("label", { class: extra.classe || null }, [rotulo, input, extra.dica ? el("div", { class: "dica", text: extra.dica }) : null]);
  }

  function cartao(iconeC, titulo, filhos, direita) {
    return el("section", { class: "cartao" }, [
      el("div", { class: "cartao-titulo" }, [el("h2", {}, [icone(iconeC), titulo]), direita || null])
    ].concat(filhos));
  }

  function montar(form, o) {
    var d = o.dados, marcarSujo = o.marcarSujo;
    d.links = d.links || [];

    // --- Aparência -------------------------------------------------------------
    var coresBox = el("div", { class: "cores" });
    var corInput = el("input", { type: "color", value: d.cor || "#7c3aed", style: "width:60px" });
    function desenharCores() {
      coresBox.innerHTML = "";
      CORES.forEach(function (c) {
        coresBox.appendChild(el("button", {
          class: "cor-bolinha" + (String(d.cor).toLowerCase() === c ? " sel" : ""), type: "button", title: c, "aria-label": "Cor " + c,
          style: "background:" + c, onclick: function () { d.cor = c; corInput.value = c; desenharCores(); marcarSujo(); }
        }));
      });
    }
    desenharCores();
    corInput.addEventListener("input", function () { d.cor = corInput.value; desenharCores(); marcarSujo(); });

    var tema = el("div", { class: "segmentado" });
    [["escuro", "fa-solid fa-moon", " Escuro"], ["claro", "fa-solid fa-sun", " Claro"]].forEach(function (t) {
      tema.appendChild(el("button", { type: "button", class: (d.tema || "escuro") === t[0] ? "sel" : null, onclick: function () {
        d.tema = t[0];
        Array.prototype.forEach.call(tema.children, function (b) { b.classList.remove("sel"); });
        this.classList.add("sel");
        marcarSujo();
      } }, [icone(t[1]), t[2]]));
    });

    form.appendChild(cartao("fa-solid fa-palette", "Aparência", [
      el("div", { class: "imagens" }, [
        el("div", {}, [el("span", { class: "upload-rotulo", text: "Foto de perfil" }), caixaUpload(o, "foto", "avatar")]),
        el("div", {}, [el("span", { class: "upload-rotulo", text: "Foto de fundo" }), caixaUpload(o, "capa", "capa"),
          el("div", { class: "dica", text: "Sem foto, o fundo usa a cor principal. Com foto, ela fica atrás da página, escurecida para os botões continuarem legíveis." })])
      ]),
      el("div", { class: "grade", style: "margin-top:18px" }, [
        el("div", {}, [el("label", { text: "Cor principal" }), el("div", { style: "display:flex;gap:10px;align-items:center;flex-wrap:wrap" }, [coresBox, corInput])]),
        el("div", {}, [el("label", { text: "Tema" }), tema])
      ])
    ]));

    // --- Informações -------------------------------------------------------------
    form.appendChild(cartao("fa-solid fa-id-card", "Informações da página", [
      el("div", { class: "grade" }, [
        campoTexto("Nome exibido", d.nome, function (v) { d.nome = v; if (o.aoMudarNome) o.aoMudarNome(); marcarSujo(); }, { classe: "todo", ph: "Nome da pessoa ou empresa", max: 80 }),
        campoTexto("Descrição", d.descricao, function (v) { d.descricao = v; marcarSujo(); }, { classe: "todo", multilinha: true, ph: "Profissão • Cidade\nUma frase sobre o negócio", max: 300, dica: "Pode usar várias linhas e emojis." })
      ])
    ]));

    // --- Links -------------------------------------------------------------------
    var listaLinks = el("div", { class: "links-lista" });
    var adicionar = el("div");
    GRUPOS_LINKS.forEach(function (g) {
      adicionar.appendChild(el("div", { class: "adicionar-grupo", text: g[0] }));
      adicionar.appendChild(el("div", { class: "adicionar" }, g[1].map(function (tipo) {
        return el("button", { type: "button", onclick: function () {
          var novo = { id: uid(), tipo: tipo };
          if (tipo === "pix") { novo.nome = d.nome || ""; }
          if (tipo === "link") { novo.icone = "fa-solid fa-link"; }
          d.links.push(novo);
          desenharLinks(novo.id);
          marcarSujo();
        } }, [icone(TIPOS[tipo].icone), TIPOS[tipo].nome]);
      })));
    });

    // Marca itens incompletos e os que vão em destaque (mesma regra da página).
    var itensLinks = [];
    function atualizarEstadosLinks() {
      var emDestaque = 0;
      itensLinks.forEach(function (x) {
        var valido = !!Perfil.resolverLink(x.l);
        var destaque = valido && emDestaque < Perfil.DESTAQUES;
        if (destaque) emDestaque++;
        x.item.classList.toggle("incompleto", !valido);
        x.item.classList.toggle("destaque", destaque);
        x.selo.hidden = !destaque;
        x.aviso.hidden = valido;
        if (!valido) x.aviso.lastChild.textContent = " Este botão ainda não aparece na página: falta preencher " + Perfil.oQueFalta(x.l) + ".";
      });
    }

    function desenharLinks(focarId) {
      listaLinks.innerHTML = "";
      itensLinks = [];
      if (!d.links.length) listaLinks.appendChild(el("div", { class: "vazio", style: "padding:24px", text: "Nenhum link ainda. Escolha abaixo o que adicionar." }));
      d.links.forEach(function (l, i) {
        var t = TIPOS[l.tipo];
        if (!t) return;
        var campos = t.campos.slice();
        if (l.tipo !== "link") campos.push({ k: "rotulo", rotulo: "Texto do botão (opcional)", ph: t.titulo || t.nome });
        var item = el("div", { class: "link-item" });
        var seloDestaque = el("span", { class: "link-destaque", title: "Aparece como ícone abaixo da descrição" }, [icone("fa-solid fa-star"), el("span", { class: "link-destaque-texto", text: "Destaque" })]);

        var ic = el("span", { class: "link-ic" }, [icone(l.tipo === "link" && l.icone ? l.icone : t.icone)]);
        if (t.cor) ic.style.background = t.cor;
        if (t.corIcone) ic.style.color = t.corIcone;
        var corpo = el("div", { class: "link-corpo" });
        campos.forEach(function (c, ci) {
          if (c.tipo === "icone") {
            var sel = el("select");
            Perfil.ICONES.forEach(function (o) { var op = el("option", { value: o[0], text: o[1] }); if (l.icone === o[0]) op.selected = true; sel.appendChild(op); });
            sel.addEventListener("change", function () { l.icone = sel.value; ic.replaceChildren(icone(sel.value)); marcarSujo(); });
            corpo.appendChild(el("label", {}, [c.rotulo, sel]));
            return;
          }
          var lab = campoTexto(c.rotulo, l[c.k], function (v) { l[c.k] = v; atualizarEstadosLinks(); marcarSujo(); },
            { ph: c.ph, dica: c.dica, classe: (c.k === "mensagem" || (campos.length % 2 === 1 && ci === campos.length - 1)) ? "todo" : null });
          corpo.appendChild(lab);
        });

        item.appendChild(el("div", { class: "link-cab" }, [
          ic,
          el("span", { class: "link-nome", text: t.nome }),
          seloDestaque,
          el("button", { class: "btn fantasma icone", type: "button", title: "Subir", "aria-label": "Subir", disabled: i === 0 ? "" : null, onclick: function () { mover(i, -1); } }, [icone("fa-solid fa-arrow-up")]),
          el("button", { class: "btn fantasma icone", type: "button", title: "Descer", "aria-label": "Descer", disabled: i === d.links.length - 1 ? "" : null, onclick: function () { mover(i, 1); } }, [icone("fa-solid fa-arrow-down")]),
          el("button", { class: "btn fantasma icone perigo-leve", type: "button", title: "Remover", "aria-label": "Remover", onclick: function () {
            d.links.splice(i, 1); desenharLinks(); marcarSujo();
          } }, [icone("fa-solid fa-trash-can")])
        ]));
        item.appendChild(corpo);
        var aviso = el("div", { class: "link-aviso", role: "status" }, [icone("fa-solid fa-circle-exclamation"), document.createTextNode("")]);
        item.appendChild(aviso);
        itensLinks.push({ l: l, item: item, selo: seloDestaque, aviso: aviso });
        listaLinks.appendChild(item);
        if (l.id === focarId) setTimeout(function () { var f = corpo.querySelector("input"); if (f) { item.scrollIntoView({ behavior: "smooth", block: "center" }); f.focus({ preventScroll: true }); } }, 30);
      });
      atualizarEstadosLinks();
    }
    function mover(i, delta) {
      var j = i + delta;
      if (j < 0 || j >= d.links.length) return;
      var x = d.links[i]; d.links[i] = d.links[j]; d.links[j] = x;
      desenharLinks(); marcarSujo();
    }
    desenharLinks();

    form.appendChild(cartao("fa-solid fa-link", "Links", [
      listaLinks,
      el("div", { class: "dica", style: "margin-top:10px", text: "Os 2 primeiros links completos aparecem em destaque, como ícones abaixo da descrição. Os demais aparecem como botões, nesta ordem. Use as setas para reordenar. Links em amarelo estão incompletos: só aparecem na página depois de preenchidos (na prévia, ficam tracejados)." }),
      adicionar
    ]));

    // --- Opções ------------------------------------------------------------------
    function interruptor(texto, chave) {
      var c = el("input", { type: "checkbox" });
      c.checked = d[chave] !== false;
      c.addEventListener("change", function () { d[chave] = c.checked; marcarSujo(); });
      return el("label", { class: "interruptor" }, [c, texto]);
    }
    var galeria = cartaoGaleria(o);
    if (galeria) form.appendChild(galeria);

    form.appendChild(cartao("fa-solid fa-sliders", "Botões extras", [
      el("div", { class: "grade" }, [
        interruptor("Mostrar \"Salvar contato\"", "mostrarSalvarContato"),
        interruptor("Mostrar \"Compartilhar\"", "mostrarCompartilhar")
      ]),
      el("div", { class: "dica", style: "margin-top:10px", text: "Ficam no fim da página. Desmarcados, não aparecem." })
    ]));

    return { desenharLinks: desenharLinks };
  }

  // Galeria de produtos (v1.7.6): até o limite liberado no cadastro do cliente (o.galeriaMax), fotos quadradas,
  // legenda e preço opcionais. Sem liberação: só a dica (o.galeriaDica), se houver.
  function cartaoGaleria(o) {
    var d = o.dados, max = o.galeriaMax || 0;
    if (!max) return o.galeriaDica ? cartao("fa-regular fa-images", "Galeria de produtos", [el("p", { class: "dica", text: o.galeriaDica })]) : null;
    if (!Array.isArray(d.galeria)) d.galeria = [];
    var lista = el("div", { class: "galeria-editor" });
    var input = el("input", { type: "file", accept: "image/*", hidden: true });
    var btnAdd = el("button", { class: "btn", type: "button", onclick: function () { input.click(); } }, [icone("fa-solid fa-plus"), " Adicionar foto"]);
    var contador = el("span", { class: "dica" });
    function desenhar() {
      lista.innerHTML = "";
      d.galeria.forEach(function (g, i) {
        var leg = el("input", { type: "text", maxlength: "60", placeholder: "Legenda (opcional)", "aria-label": "Legenda da foto " + (i + 1) });
        leg.value = g.legenda || "";
        leg.addEventListener("input", function () { g.legenda = leg.value; o.marcarSujo(); });
        var preco = el("input", { type: "text", maxlength: "20", placeholder: "Preço (opcional)", "aria-label": "Preço da foto " + (i + 1) });
        preco.value = g.preco || "";
        preco.addEventListener("input", function () { g.preco = preco.value; o.marcarSujo(); });
        function mover(passo) {
          var j = i + passo, t = d.galeria[i];
          d.galeria[i] = d.galeria[j]; d.galeria[j] = t;
          desenhar(); o.marcarSujo();
        }
        lista.appendChild(el("div", { class: "galeria-item-ed" }, [
          el("img", { src: g.foto, alt: "" }),
          el("div", { class: "galeria-campos" }, [leg, preco]),
          el("div", { class: "galeria-botoes" }, [
            el("button", { class: "btn pequeno icone", type: "button", title: "Subir", "aria-label": "Subir foto " + (i + 1), disabled: i === 0, onclick: function () { mover(-1); } }, [icone("fa-solid fa-arrow-up")]),
            el("button", { class: "btn pequeno icone", type: "button", title: "Descer", "aria-label": "Descer foto " + (i + 1), disabled: i === d.galeria.length - 1, onclick: function () { mover(1); } }, [icone("fa-solid fa-arrow-down")]),
            el("button", { class: "btn pequeno icone perigo-leve", type: "button", title: "Remover", "aria-label": "Remover foto " + (i + 1), onclick: function () { d.galeria.splice(i, 1); desenhar(); o.marcarSujo(); } }, [icone("fa-solid fa-trash-can")])
          ])
        ]));
      });
      btnAdd.hidden = d.galeria.length >= max;
      contador.textContent = d.galeria.length + " de " + max + (max === 1 ? " foto" : " fotos");
    }
    input.addEventListener("change", function () {
      var arquivo = input.files[0];
      input.value = "";
      if (!arquivo) return;
      btnAdd.disabled = true;
      abrirImagem(arquivo).then(function (img) { return ajustarFoto(img, "produto"); })
        .then(function (c) { return c && canvasParaBlob(c).then(function (blob) { return o.enviarImagem(blob, "galeria"); }); })
        .then(function (u) {
          if (!u) return;
          if (o.registrarImagem) o.registrarImagem(u);
          if (o.ativo && !o.ativo()) return;   // o editor já foi fechado
          d.galeria.push({ id: "g" + uid(), foto: u, legenda: "", preco: "" });
          desenhar(); o.marcarSujo();
        })
        .catch(o.falhou)
        .then(function () { btnAdd.disabled = false; });
    });
    desenhar();
    return cartao("fa-regular fa-images", "Galeria de produtos", [
      el("p", { class: "sub", style: "margin:-6px 0 12px", text: "Fotos dos produtos ou trabalhos, em carrossel no fim da página. Cada foto ganha o botão \"Quero este\", que abre o WhatsApp da página com a legenda e o preço." }),
      lista, el("div", { class: "galeria-rodape" }, [btnAdd, contador]), input
    ]);
  }

  // ---------------------------------------------------------------------------
  // Upload de imagem (redimensiona no navegador antes de enviar)
  // ---------------------------------------------------------------------------
  function erroAmigavel(msg) { return Object.assign(new Error(msg), { amigavel: true }); }
  // Abre um arquivo (ou um endereço) como imagem
  function abrirImagem(origem) {
    return new Promise(function (ok, falha) {
      var arquivo = typeof origem !== "string";
      if (arquivo && !/^image\//.test(origem.type)) return falha(erroAmigavel("Escolha um arquivo de imagem (JPG, PNG ou WEBP)."));
      var img = new Image(), url = arquivo ? URL.createObjectURL(origem) : origem;
      if (!arquivo && !/^data:/.test(url)) img.crossOrigin = "anonymous";   // foto já enviada: o armazenamento libera a leitura
      img.onload = function () { if (arquivo) URL.revokeObjectURL(url); ok(img); };
      img.onerror = function () { if (arquivo) URL.revokeObjectURL(url); falha(erroAmigavel("Não foi possível abrir essa imagem.")); };
      img.src = url;
    });
  }
  // Canvas → arquivo WEBP (ou JPG, nos navegadores sem WEBP)
  function canvasParaBlob(c) {
    return new Promise(function (ok, falha) {
      c.toBlob(function (b) {
        if (b && b.type === "image/webp") return ok(b);
        c.toBlob(function (j) { j ? ok(j) : falha(new Error("Não foi possível processar a imagem.")); }, "image/jpeg", 0.85);
      }, "image/webp", 0.85);
    });
  }
  function processarImagem(arquivo, max, quadrado) {
    return abrirImagem(arquivo).then(function (img) {
      var sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
      if (quadrado) { var lado = Math.min(sw, sh); sx = (sw - lado) / 2; sy = (sh - lado) / 2; sw = sh = lado; }
      var escala = Math.min(1, max / Math.max(sw, sh));
      var c = document.createElement("canvas");
      c.width = Math.round(sw * escala); c.height = Math.round(sh * escala);
      var ctx = c.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      return canvasParaBlob(c);
    });
  }

  // Formatos da janela de ajuste: foto do perfil (círculo) e foto de fundo (tela do celular, 9:16)
  var FORMATOS = {
    avatar: { titulo: "Ajustar foto", larg: 280, alt: 280, max: 600, circulo: true,
      texto: "Arraste para posicionar o rosto dentro do círculo e use o zoom para aproximar." },
    produto: { titulo: "Ajustar foto do produto", larg: 280, alt: 280, max: 1080, circulo: false,
      texto: "Arraste para posicionar o produto dentro do quadrado e use o zoom para aproximar." },
    capa: { titulo: "Ajustar foto de fundo", larg: 225, alt: 400, max: 900, circulo: false,
      texto: "A moldura é a tela do celular: o que estiver dentro dela aparece no fundo da página. Arraste para posicionar e use o zoom." }
  };

  // Janela de ajuste: arrastar para posicionar, zoom e girar. Devolve a imagem recortada (canvas) ou null se cancelar.
  function ajustarFoto(img, formato) {
    var F = FORMATOS[formato] || FORMATOS.avatar;
    return new Promise(function (ok) {
      var VW = F.larg, VH = F.alt;
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var giro = 0, zoom = 1, ox = 0, oy = 0;   // giro em graus; ox/oy: deslocamento do centro da imagem, em px da moldura
      var tela = el("canvas", { class: "ajuste-tela", width: String(VW * dpr), height: String(VH * dpr), "aria-label": "Arraste para posicionar a imagem" });
      tela.style.width = VW + "px"; tela.style.height = VH + "px";
      var regua = el("input", { type: "range", min: "1", max: "4", step: "0.01", "aria-label": "Zoom" });
      regua.value = "1";
      function medidas() {
        var deitada = giro % 180 !== 0;
        var w = deitada ? img.naturalHeight : img.naturalWidth, h = deitada ? img.naturalWidth : img.naturalHeight;
        var esc = Math.max(VW / w, VH / h) * zoom;   // zoom 1: a imagem cobre a moldura inteira
        return { w: w * esc, h: h * esc, esc: esc };
      }
      function limitar() {   // a imagem sempre cobre a moldura
        var m = medidas(), mx = (m.w - VW) / 2, my = (m.h - VH) / 2;
        ox = Math.max(-mx, Math.min(mx, ox)); oy = Math.max(-my, Math.min(my, oy));
      }
      function desenhar(c, lw, lh) {
        var ctx = c.getContext("2d"), k = lw / VW, m = medidas();
        ctx.clearRect(0, 0, lw, lh);
        ctx.imageSmoothingQuality = "high";
        ctx.save();
        ctx.translate(lw / 2 + ox * k, lh / 2 + oy * k);
        ctx.rotate(giro * Math.PI / 180);
        ctx.scale(m.esc * k, m.esc * k);
        ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
        ctx.restore();
      }
      function atualizar() { limitar(); desenhar(tela, VW * dpr, VH * dpr); }
      function mudarZoom(z) { zoom = Math.max(1, Math.min(4, z)); regua.value = String(zoom); atualizar(); }

      // Arrastar (mouse ou dedo)
      var arraste = null;
      tela.addEventListener("pointerdown", function (e) { arraste = { x: e.clientX, y: e.clientY }; tela.setPointerCapture(e.pointerId); });
      tela.addEventListener("pointermove", function (e) {
        if (!arraste) return;
        ox += e.clientX - arraste.x; oy += e.clientY - arraste.y;
        arraste = { x: e.clientX, y: e.clientY };
        atualizar();
      });
      ["pointerup", "pointercancel"].forEach(function (ev) { tela.addEventListener(ev, function () { arraste = null; }); });
      tela.addEventListener("wheel", function (e) { e.preventDefault(); mudarZoom(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)); }, { passive: false });
      regua.addEventListener("input", function () { mudarZoom(+regua.value); });

      var fundo;
      function fechar(resultado) {
        document.removeEventListener("keydown", tecla);
        fundo.remove();
        ok(resultado);
      }
      function tecla(e) { if (e.key === "Escape") fechar(null); }
      function usar() {
        // Resolução de saída: a da própria imagem dentro da moldura, entre metade e o máximo do formato
        var lw = Math.round(Math.min(F.max, Math.max(VW / medidas().esc, F.max / 2)));
        var c = document.createElement("canvas");
        c.width = lw; c.height = Math.round(lw * VH / VW);
        desenhar(c, c.width, c.height);
        fechar(c);
      }
      fundo = el("div", { class: "modal-fundo" }, [el("div", { class: "modal ajuste-foto", role: "dialog", "aria-modal": "true", "aria-label": F.titulo }, [
        el("h2", { text: F.titulo }),
        el("p", { text: F.texto }),
        el("div", { class: "ajuste-area" + (F.circulo ? " circulo" : ""), style: "width:" + VW + "px;height:" + VH + "px" }, [tela]),
        el("div", { class: "ajuste-controles" }, [
          icone("fa-solid fa-magnifying-glass-minus"), regua, icone("fa-solid fa-magnifying-glass-plus"),
          el("button", { class: "btn pequeno", type: "button", title: "Girar 90°", "aria-label": "Girar 90°", onclick: function () { giro = (giro + 90) % 360; atualizar(); } }, [icone("fa-solid fa-rotate-right")])
        ]),
        el("div", { class: "modal-botoes" }, [
          el("button", { class: "btn", type: "button", text: "Cancelar", onclick: function () { fechar(null); } }),
          el("button", { class: "btn primario", type: "button", onclick: usar }, [icone("fa-solid fa-check"), " Usar foto"])
        ])
      ])]);
      document.addEventListener("keydown", tecla);
      document.body.appendChild(fundo);
      atualizar();
    });
  }

  function caixaUpload(o, chave, classe) {
    var d = o.dados, marcarSujo = o.marcarSujo;
    var input = el("input", { type: "file", accept: "image/*" });
    var textoPrincipal = el("span", { text: "Clique ou arraste uma imagem" });
    var textoSub = el("small");
    var caixa = el("label", { class: "upload " + classe }, [
      input,
      el("span", { class: "upload-texto" }, [icone("fa-solid fa-camera"), textoPrincipal, textoSub])
    ]);
    var remover = el("button", { class: "upload-remover", type: "button", title: "Remover imagem", "aria-label": "Remover imagem", onclick: function (e) {
      e.preventDefault();
      d[chave] = "";
      atualizar(); marcarSujo();
    } }, [icone("fa-solid fa-xmark")]);
    caixa.appendChild(remover);
    // Reposicionar a imagem que já está na página, sem enviar de novo
    var ajustar = el("button", { class: "upload-ajustar", type: "button", onclick: function (e) {
      e.preventDefault();
      if (!d[chave]) return;
      caixa.classList.add("carregando");
      abrirImagem(d[chave]).then(function (img) { caixa.classList.remove("carregando"); return ajustarFoto(img, classe); })
        .then(function (c) { return c && canvasParaBlob(c).then(subir); })
        .catch(function () { o.falhou(erroAmigavel("Não foi possível abrir a foto atual para ajustar. Envie a foto de novo.")); })
        .then(function () { caixa.classList.remove("carregando"); });
    } }, [icone("fa-solid fa-crop-simple"), " Ajustar"]);
    caixa.appendChild(ajustar);

    function atualizar() {
      var u = d[chave];
      caixa.style.backgroundImage = u ? "url(\"" + String(u).replace(/"/g, "%22") + "\")" : "";
      caixa.classList.toggle("tem-imagem", !!u);
      remover.hidden = !u;
      ajustar.hidden = !u;
      if (classe === "capa") {
        // Sem foto, mostra o fundo padrão na cor e no tema atuais
        caixa.classList.toggle("fundo-padrao", !u);
        caixa.classList.toggle("claro", !u && d.tema === "claro");
        caixa.style.setProperty("--cor", d.cor || "#7c3aed");
        textoPrincipal.textContent = u ? "Trocar foto de fundo" : "Sem foto: fundo na cor principal";
        textoSub.textContent = u ? "" : "Clique ou arraste para enviar uma foto";
      }
    }
    if (classe === "capa" && o.aoMudar) o.aoMudar.push(atualizar);
    // Envia a imagem pronta e coloca na página (vale ao salvar)
    function subir(blob) {
      caixa.classList.add("carregando");
      return o.enviarImagem(blob, chave).then(function (u) {
        if (o.registrarImagem) o.registrarImagem(u);
        if (o.ativo && !o.ativo()) return;   // o editor já foi fechado
        d[chave] = u;
        atualizar(); marcarSujo();
      });
    }
    function enviar(arquivo) {
      if (!arquivo) return;
      // Abre a janela de ajuste antes de enviar (círculo para a foto do perfil, tela do celular para o fundo)
      var pronta = abrirImagem(arquivo).then(function (img) { return ajustarFoto(img, classe); }).then(function (c) { return c && canvasParaBlob(c); });
      input.value = "";
      pronta.then(function (blob) { return blob && subir(blob); })
        .catch(o.falhou)
        .then(function () { caixa.classList.remove("carregando"); });
    }
    input.addEventListener("change", function () { enviar(input.files[0]); });
    ["dragenter", "dragover"].forEach(function (ev) { caixa.addEventListener(ev, function (e) { e.preventDefault(); caixa.classList.add("arrastando"); }); });
    ["dragleave", "drop"].forEach(function (ev) { caixa.addEventListener(ev, function (e) { e.preventDefault(); caixa.classList.remove("arrastando"); }); });
    caixa.addEventListener("drop", function (e) { enviar(e.dataTransfer.files[0]); });
    atualizar();
    return caixa;
  }

  window.EditorPerfil = { montar: montar, campoTexto: campoTexto, cartao: cartao, processarImagem: processarImagem };
})();
