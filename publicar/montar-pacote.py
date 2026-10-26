#!/usr/bin/env python3
"""Gera publicar/nfcliente-site.zip com só os arquivos do site (sem README, SQL etc.).

O pacote tem duas partes, extraídas em public_html na Hostinger:
- raiz: o site público nfcliente.com.br (páginas dos perfis, sem nenhum código de login);
- painel-admin/: o painel, que abre em admin.nfcliente.com.br (pasta do subdomínio);
- painel-cliente/: a página em que o cliente edita o próprio perfil (cliente.nfcliente.com.br).

Uso: python3 publicar/montar-pacote.py
Depois faça commit e peça a publicação (veja "Atualizar o site" no README).
"""
import os
import subprocess
import time
import zipfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESTINO = os.path.join(RAIZ, "publicar", "nfcliente-site.zip")

# (caminho no pacote, arquivo no repositório)
SITE_PUBLICO = [(f, f) for f in [
    "index.html", "perfil.html", ".htaccess",
    "css/perfil.css",
    "js/config.js", "js/perfil-render.js", "js/publico.js", "js/pagina-perfil.js",
    "js/lib/qrcode-1.0.0.min.js",
    "favicon.ico", "img/nfcliente-icone.svg", "img/apple-touch-icon.png", "img/nfcliente-logo-escuro.svg",
]]
PAINEL = [("painel-admin/" + destino, origem) for destino, origem in [
    ("index.html", "admin/index.html"), ("admin.js", "admin/admin.js"), ("admin.css", "admin/admin.css"),
    ("redefinir-senha.html", "admin/redefinir-senha.html"), ("redefinir-senha.js", "admin/redefinir-senha.js"),
    (".htaccess", "admin/.htaccess"),
    ("css/perfil.css", "css/perfil.css"),
    ("js/config.js", "js/config.js"), ("js/db.js", "js/db.js"), ("js/perfil-render.js", "js/perfil-render.js"), ("js/editor-perfil.js", "js/editor-perfil.js"),
    ("js/lib/supabase-js-2.117.2.js", "js/lib/supabase-js-2.117.2.js"), ("js/lib/qrcode-1.0.0.min.js", "js/lib/qrcode-1.0.0.min.js"),
    ("favicon.ico", "favicon.ico"), ("img/nfcliente-icone.svg", "img/nfcliente-icone.svg"), ("img/apple-touch-icon.png", "img/apple-touch-icon.png"),
]]
CLIENTE = [("painel-cliente/" + destino, origem) for destino, origem in [
    ("index.html", "cliente/index.html"), ("cliente.js", "cliente/cliente.js"), (".htaccess", "cliente/.htaccess"),
    ("admin/admin.css", "admin/admin.css"), ("css/perfil.css", "css/perfil.css"),
    ("js/config.js", "js/config.js"), ("js/perfil-render.js", "js/perfil-render.js"), ("js/editor-perfil.js", "js/editor-perfil.js"),
    ("js/lib/qrcode-1.0.0.min.js", "js/lib/qrcode-1.0.0.min.js"),
    ("favicon.ico", "favicon.ico"), ("img/nfcliente-icone.svg", "img/nfcliente-icone.svg"), ("img/apple-touch-icon.png", "img/apple-touch-icon.png"),
]]
ARQUIVOS = SITE_PUBLICO + PAINEL + CLIENTE


def data_do_arquivo(origem):
    """Data gravada no zip (vira a "última modificação" do arquivo no servidor).

    Precisa mudar quando o conteúdo muda: o navegador pergunta ao servidor "mudou desde tal data?"
    e, com a mesma data de antes, recebe "não mudou" e continua mostrando a versão antiga.
    Arquivo igual ao último commit: a data desse commit (o mesmo conteúdo gera o mesmo zip).
    Arquivo alterado e ainda não salvo no git: a data de agora.
    """
    def git(*args):
        return subprocess.run(["git", "-C", RAIZ] + list(args), capture_output=True, text=True).stdout.strip()
    try:
        alterado = git("status", "--porcelain", "--", origem)
        quando = git("log", "-1", "--format=%ct", "--", origem)
        if quando and not alterado:
            return time.gmtime(int(quando))[:6]
    except OSError:
        pass
    return time.gmtime()[:6]


with zipfile.ZipFile(DESTINO, "w", zipfile.ZIP_DEFLATED) as z:
    for destino, origem in ARQUIVOS:
        info = zipfile.ZipInfo(destino, date_time=data_do_arquivo(origem))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        with open(os.path.join(RAIZ, origem), "rb") as f:
            z.writestr(info, f.read())
print("Pacote gerado:", os.path.relpath(DESTINO, RAIZ), os.path.getsize(DESTINO), "bytes,", len(ARQUIVOS), "arquivos",
      "(" + str(len(SITE_PUBLICO)), "do site público +", len(PAINEL), "do painel +", len(CLIENTE), "da página do cliente)")
