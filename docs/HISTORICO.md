# Histórico de versões

O que mudou no sistema, da versão mais nova para a mais antiga. O detalhe técnico de cada mudança está no histórico de commits do GitHub.

## Como as versões são numeradas

- **Melhoria nova** (por exemplo, vencimento automático): sobe o número do meio. `v1.0.0` → `v1.1.0` → `v1.2.0`.
- **Correção pequena** numa versão: sobe o último número. `v1.1.0` → `v1.1.1`.
- **Mudança grande**, que muda o jeito de usar o sistema: sobe o primeiro número. `v1.x` → `v2.0.0`.

Cada versão publicada ganha um **ponto de restauração** no GitHub, um branch chamado `versao-X.Y.Z`. Ele fica congelado com o código, a documentação, o pacote do site (`publicar/nfcliente-site.zip`) e a estrutura do banco (`supabase/schema.sql`) daquela versão. Para voltar a uma versão, siga [`RESTAURAR.md`](RESTAURAR.md).

Quando uma versão mexer no banco, ela também traz um script para desfazer a mudança. Os scripts ficam em `supabase/versoes/`.

## v1.7.0 · 19/10/2026: painel do gestor, segmentos e avisos para os clientes (ponto de restauração `versao-1.7.0`)

- **Publicada em 19/10/2026:** banco atualizado e os 28 arquivos do site, do painel e da página do cliente no ar conferidos um a um contra o pacote.
- **Aba "Gestor"** no painel, só para administradores:
  - **Segmentos:** incluir, renomear e excluir. Nome repetido é recusado. Excluir deixa os perfis "sem segmento".
  - **Links e avisos nos painéis dos clientes:** link (https, e-mail ou WhatsApp só com o número) ou aviso, para todos, alguns segmentos ou alguns perfis; ligar e desligar.
- **Segmento nos perfis:** no editor do perfil e no painel do cliente (só entre os da lista; vale ao salvar). Filtro por segmento na lista de perfis.
- **Painel do cliente:** mostra no topo os links e avisos que valem para ele. Links que não sejam https, e-mail ou telefone são ignorados, e o texto dos avisos aparece como texto puro.
- **Banco: mudou.**
  - Tabelas `segmentos` e `avisos_clientes` (só administradores leem e alteram) e o campo `perfis.segmento_id`.
  - Função nova `cliente_extras` e `cliente_salvar` passou a aceitar o segmento (só um da lista).
  - Script: `supabase/versoes/v1.7.0.sql`, também incluído no `schema.sql`. Para desfazer: `supabase/versoes/v1.7.0-desfazer.sql`.
- **Conferido no banco** (teste desfeito ao final): nome repetido e link `javascript:` recusados; o cliente recebe só os avisos dele; segmento inexistente ou inválido recusado; visitantes não leem as tabelas novas.

## v1.6.2 · 16/10/2026: ajustar a foto de fundo (ponto de restauração `versao-1.6.2`)

- **Publicada em 16/10/2026:** arquivos do site e do painel no ar conferidos contra o pacote; os da página do cliente conferidos pelo tamanho.
- **Janela "Ajustar foto de fundo":** a mesma da foto do perfil (arrastar, zoom e girar), com uma moldura retangular no formato da tela do celular (9:16). Também ganhou o botão **Ajustar** na foto atual.
- **Fundo na primeira tela:** a foto de fundo passou a ocupar a primeira tela do celular e se dissolver na cor da página logo abaixo. Antes, ela se esticava pela altura da página inteira e, em páginas com muitos links, ficava muito ampliada. Assim, o que se enquadra na moldura é o que o visitante vê. A prévia do painel mostra o mesmo.
- **Banco:** não mudou.

## v1.6.1 · 14/10/2026: ajustar a foto do perfil (ponto de restauração `versao-1.6.1`)

- **Publicada em 14/10/2026:** arquivos do site, do painel e da página do cliente no ar conferidos contra o pacote.
- **Janela "Ajustar foto":** ao escolher a foto de perfil, ela abre com o círculo do perfil por cima.
  - Arrastar (mouse ou dedo) para posicionar o rosto, zoom na barra (ou na rodinha do mouse) e girar 90°.
  - **Usar foto** envia o recorte; **Cancelar** (ou Esc) mantém a foto anterior.
  - Antes, o sistema cortava sempre o centro da imagem.
- **Botão "Ajustar"** na foto atual: reposiciona sem enviar de novo. A foto antiga já estava cortada, então dá para aproximar e mover, mas não recuperar o que ficou de fora.
- Vale no painel e na página do cliente (o editor é o mesmo). A foto de fundo continua sendo só reduzida, porque ocupa a página inteira e o recorte muda com o tamanho da tela.
- **Banco:** não mudou.

## v1.6.0 · 14/10/2026: destaques nas cores dos aplicativos (ponto de restauração `versao-1.6.0`)

- **Publicada em 14/10/2026:** arquivos do site, do painel e da página do cliente no ar conferidos contra o pacote.
- **Destaques mais evidentes:** os botões redondos em destaque usam a cor original de cada app (degradê do Instagram, verde do WhatsApp, azul do Facebook etc.), com a borda na cor escolhida para a página. Site e link personalizado, que não têm cor própria, usam a cor da página.
- Botões um pouco maiores e com sombra. Vale na página pública, na prévia do painel e na página do cliente.
- **Banco:** não mudou.

## v1.5.0 · 14/10/2026: teste grátis de 3 dias (ponto de restauração `versao-1.5.0`)

- **Publicada em 14/10/2026:** campo novo aplicado no banco; arquivos do site, do painel e da página do cliente no ar conferidos contra o pacote.
- **Teste grátis:** botão **"Teste 3 dias"** nos perfis em configuração. A página fica no ar hoje e mais 3 dias e depois sai sozinha.
  - Usa o vencimento automático da v1.1.0: o vencimento fica no dia do início.
  - Durante o teste, já dá para gerar o link para o cliente editar (v1.3.0).
- **Efetivar:** quando o cliente fecha, o teste vira assinatura: no ar e vencimento daqui a 1 mês. Renovar ou mudar o vencimento no editor também efetiva.
- **Selos e filtros:** "Em teste · até dd/mm" e "Teste não fechou", com filtros próprios. Os testes ficam fora do filtro "Vencidos".
- **Banco: mudou.**
  - Campo novo `perfis.teste_desde` (dia em que o teste começou). A página pública e as regras de segurança não mudaram.
  - Script: `supabase/versoes/v1.5.0.sql`, também incluído no `schema.sql`.
  - Para desfazer: `supabase/versoes/v1.5.0-desfazer.sql`.
- **Caixa de ideias:** as próximas evoluções ficam em [`IDEIAS.md`](IDEIAS.md).

## v1.4.0 · 13/10/2026: foto do perfil na lista de clientes (ponto de restauração `versao-1.4.0`)

- **Foto do cliente:** na aba Clientes, a bolinha com as iniciais passa a mostrar a foto do perfil ligado ao cliente.
  - Com mais de um perfil, vale a do perfil no ar; se nenhum estiver no ar, a do primeiro perfil com foto.
  - Sem foto, sem perfil ou se a imagem não carregar: continuam as iniciais.
  - A foto vem do perfil; o cadastro do cliente não ganhou campo de foto.
- **Publicada em 13/10/2026:** os arquivos do site e do painel no ar conferidos contra o pacote.
- **Banco:** não mudou. A lista de clientes passou a buscar também a situação e a foto dos perfis de cada cliente.

## v1.3.0 · 13/10/2026: link para o cliente editar o próprio perfil (ponto de restauração `versao-1.3.0`)

- **Publicada em 13/10/2026:**
  - os 31 arquivos no ar conferidos contra o pacote, incluindo os 9 de `painel-cliente`;
  - `/painel-cliente` pelo endereço do site dá 404, e o painel e os perfis seguem normais.
- **Conferida no ar**, no perfil de teste studio-tati, com um cliente temporário:
  - PIN errado, código errado e acesso falso recusados; PIN certo entra;
  - salvar vai ao ar na hora; link `javascript:` e foto de outro site recusados;
  - envio de foto aceito, e arquivo que não é imagem recusado;
  - a função de fotos só aceita pedidos vindos de `cliente.nfcliente.com.br`;
  - depois do teste, os dados originais do perfil foram restaurados e o link de teste foi revogado.
- **Link para o cliente editar:**
  - no editor do perfil, o cartão **"Link para o cliente editar"** gera o link, com os botões **Copiar link** e **Enviar pelo WhatsApp**, e revoga;
  - só para perfil no ar, dentro do vencimento e ligado a um cliente;
  - vale até ser revogado; gerar um novo cancela o anterior.
- **Página do cliente em `cliente.nfcliente.com.br`**, na pasta `public_html/painel-cliente`:
  - pede o PIN toda vez: os 4 últimos dígitos do WhatsApp ou do telefone do cadastro;
  - 5 PINs errados bloqueiam o link por 30 minutos, e cada acesso dura 2 horas;
  - mostra só aparência, informações, links e botões extras, com prévia;
  - as alterações vão ao ar só quando o cliente clica em **Salvar**;
  - se o acesso expirar no meio da edição, pede o PIN de novo sem perder o que foi feito.
- **Histórico de alterações:** cada alteração, do painel ou do cliente, guarda a versão anterior. O cartão no editor mostra as últimas 15, e **Carregar** traz uma delas de volta para o editor.
- **Editor compartilhado:** o painel e a página do cliente usam o mesmo editor (`js/editor-perfil.js`).
- **Banco: mudou.**
  - Tabelas `links_cliente`, `sessoes_cliente` e `perfis_historico`, e funções que conferem o PIN, o acesso e tudo o que o cliente salva.
  - Script: `supabase/versoes/v1.3.0.sql`, também incluído no `schema.sql`.
  - Para desfazer: `supabase/versoes/v1.3.0-desfazer.sql`.
- **Função nova no Supabase:** `cliente-imagem` recebe as fotos do cliente e confere tamanho, tipo e conteúdo. Ela fica em `supabase/functions/`.
- **Links reservados:** `cliente`, `painel-cliente`, `editar`, `docs` e `ferramentas`.
- **Servidor local:** a página do cliente abre em `http://cliente.localhost:3000/#<código>`.

## v1.2.0 · 13/10/2026: página pública blindada e painel em endereço próprio (ponto de restauração `versao-1.2.0`)

- **Publicada em 13/10/2026:**
  - os 21 arquivos no ar conferidos contra o pacote;
  - o site público não tem mais nenhum código do painel;
  - a mudança do banco foi aplicada depois, e a leitura como visitante foi conferida.
- **Conferida no ar em 13/10/2026**, de fora do servidor:
  - 27 endereços, com redirecionamentos e bloqueios;
  - cabeçalhos: uma CSP por pedido, a certa para cada parte;
  - consulta real ao banco com a chave pública;
  - navegador no perfil (fotos e QR do Pix), no link inexistente, no login do painel e na página de nova senha;
  - nenhum erro e nenhuma violação de CSP.
- **Testada antes num Apache montado como a Hostinger**, com o site em `public_html` e o painel em `public_html/painel-admin`:
  - cada pedido recebe uma única lista de permissões (CSP);
  - o painel só abre pelo subdomínio;
  - os redirecionamentos `/admin` mantêm o código do e-mail;
  - a renovação do certificado passa.

- **Painel em `admin.nfcliente.com.br`**, na pasta `public_html/painel-admin`, que é a do subdomínio.
  - O login do administrador fica guardado só nesse endereço, fora do alcance das páginas públicas.
  - O antigo `nfcliente.com.br/admin/...` leva para o endereço novo com os mesmos parâmetros, então os links dos e-mails de senha continuam valendo.
  - O painel tem regras próprias: só abre pelo endereço do painel, não roda PHP e não aparece em buscadores.
  - **Na primeira vez, é preciso entrar de novo**, porque o endereço é outro.
- **Página pública sem código de login:**
  - carrega só o necessário para mostrar o perfil;
  - faz uma única consulta ao banco, com o novo `js/publico.js`;
  - o site público não recebe mais o `db.js` nem a biblioteca do Supabase;
  - apaga um login antigo do painel que tenha ficado guardado no endereço do site.
- **Regras mais rígidas nas páginas públicas:** nenhum formulário, nenhuma moldura (iframe) e conexão só com o Supabase.
- **Resposta única:** link inexistente, desativado, vencido ou em configuração mostram "Perfil indisponível". Antes, eram "Em breve", "temporariamente indisponível" e "não encontrada".
- **Banco: mudou.**
  - `perfil_publico` passou a devolver conteúdo só de perfil no ar e dentro do vencimento; em qualquer outro caso, nada.
  - Para desfazer: `supabase/versoes/v1.2.0-desfazer.sql`.
- **Links reservados:** `painel` e `painel-admin` não podem ser usados como link de perfil.
- **Servidor local:** o painel abre em `http://admin.localhost:3000/`, como no site.

## v1.1.0 · 13/10/2026: perfil sai do ar sozinho quando a cobrança vence (ponto de restauração `versao-1.1.0`)

- **Regra:**
  - com data de vencimento, a página continua no ar até 3 dias depois do vencimento (carência);
  - no 4º dia mostra "Perfil temporariamente indisponível";
  - sem data, nunca sai do ar.
- **Renovar +1 mês**, na lista e no perfil: avança o vencimento em 1 mês e o perfil volta ao ar na hora.
- **Painel:**
  - selo "Fora do ar · vencido";
  - avisos "vence em X dias" e "sai do ar em…";
  - contagem no resumo;
  - o filtro "No ar" não mostra perfis vencidos.
- **Data de vencimento:** só aceita anos de 2000 a 2099; uma data inválida não é salva.
- **"Reativar" e "Liberar":** avisam quando o vencimento já passou da carência, porque nesse caso a página continua fora do ar até renovar.
- **Banco: mudou.**
  - nova função `perfil_vencido`;
  - `perfil_publico` passou a conferir o vencimento.
  - Para desfazer: `supabase/versoes/v1.1.0-desfazer.sql`.
- **Publicada em 13/10/2026.** Os 15 arquivos no ar foram conferidos contra o pacote do branch `versao-1.1.0`.
- **Teste ao vivo:** o perfil de teste `studio-tati-cilios` (vencimento 10/10/2026) sai do ar em 14/10/2026.

## v1.0.0 · 13/10/2026: versão estável (ponto de restauração `versao-1.0.0`)

É a versão que está no ar desde 06/10/2026 e funciona sem problemas. Em relação à v0.2.0, o site não mudou: só a documentação e as ferramentas.

- **Banco:** conferido em 13/10/2026; a estrutura real é idêntica a `supabase/schema.sql`.
- Projeto renomeado para **NFCliente** no GitHub (`BruTeclas/NFCliente`).
- README revisado:
  - hospedagem na Hostinger;
  - configurações do Supabase já feitas;
  - plano gratuito do Supabase: pausa e cotas;
  - backup por tags e releases;
  - verificação em duas etapas nas contas.
- **Servidor local** (`ferramentas/servidor-local.js`): testa o site no computador com as mesmas regras e cabeçalhos de segurança da Hostinger, com ou sem modo demonstração.
- Este histórico e um `.gitignore`, que impede enviar arquivos de senha (`.env`) e pastas temporárias ao GitHub.

## v0.2.0 · 06/10/2026: ajustes de segurança

Feitos a partir da análise de segurança. O relatório é confidencial e não fica no GitHub.

- **Bibliotecas:**
  - o Supabase e o gerador de QR Code passaram a ficar dentro do site (`js/lib/`), com versão fixa;
  - uma versão nova ou adulterada publicada por terceiros não entra mais sozinha no ar.
- **Cabeçalhos de segurança:**
  - **CSP:** o navegador só roda scripts do próprio site;
  - **HSTS:** sempre HTTPS.
  - Para isso, os scripts que ficavam embutidos nas páginas foram para arquivos `.js`.
- **Páginas públicas:** consultam o banco como visitante, sem usar o login do painel.
- **Endereço do cliente:**
  - não vai mais sozinho para a página do perfil;
  - ao criar o perfil, há a caixa "Incluir também o endereço", que vem desmarcada.
- **Banco:**
  - a promoção automática a administrador ficou mais rígida;
  - só vale para contas criadas ou convidadas pelo painel do Supabase.
- **Contas e Supabase (ajustes feitos por você):**
  - verificação em duas etapas;
  - cadastro público desligado;
  - "Secure password change" ligado.
- **Publicação:**
  - a pasta das bibliotecas se chama `js/lib`, porque a publicação da Hostinger descarta pastas chamadas `vendor`;
  - essa falha deixou o site cerca de 10 minutos sem a biblioteca do Supabase em 06/10/2026, já corrigida.
- **Repositório no GitHub:** recomendado mantê-lo privado, publicando com a chave de implantação da Hostinger.
- Guia de restauração ([`RESTAURAR.md`](RESTAURAR.md)).

## v0.1.0 · 05/10/2026: primeira versão no ar

- **Página do perfil** para chaveiro NFC:
  - links de WhatsApp, Pix (QR Code e Copia e Cola), Google, contato e 16 redes sociais;
  - botões "Salvar contato" e "Compartilhar".
- **Painel com login:**
  - "Ativar novo perfil", configurar, liberar, desativar (pagamento atrasado) e excluir;
  - modo demonstração com perfis de exemplo.
- **Visual:**
  - os 2 primeiros links aparecem em destaque abaixo da descrição;
  - sem foto de fundo, o fundo usa a cor principal do perfil;
  - rodapé "Desenvolvido por FrontIA" com link para frontia.com.br.
- **Supabase:**
  - cadastro de clientes (CPF/CNPJ, contatos, endereço, redes, plano e valor);
  - login de administrador, "Esqueci minha senha", troca de senha;
  - e-mails em português.
- **Publicação na Hostinger** em `nfcliente.com.br`, com HTTPS.
- **Links que faltava preencher:**
  - o editor mostra o que falta em cada link;
  - a prévia mostra o botão tracejado.
- **WhatsApp:** passou a funcionar com número sem o 55.
