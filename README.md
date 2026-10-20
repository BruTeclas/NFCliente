# NFCliente · Perfis para chaveiros NFC

Sistema para criar e gerenciar páginas de links ("link na bio") para clientes.
Cada cliente ganha um endereço próprio, por exemplo `nfcliente.com.br/studio-bella`,
que é gravado no chaveiro. Quando alguém aproxima o chaveiro do celular, a página abre.

## Como funciona

```
                ┌──────────────────────────────┐
 Chaveiro NFC → │ nfcliente.com.br/studio-bella │ → perfil.html busca o perfil "studio-bella"
                └──────────────────────────────┘          │
                                                           ▼
 Você → admin.nfcliente.com.br (login) ──────────► Supabase (banco + fotos)
        cria, edita, ativa, desativa, exclui               ▲
                                                           │
 Cliente → cliente.nfcliente.com.br/#código (PIN) ─────────┘
           edita só o próprio perfil e salva
```

- **Site público:** arquivos estáticos na Hostinger, em `nfcliente.com.br`. As páginas dos perfis não têm nenhum código de login (veja *Hospedagem*).
- **Painel:** `admin.nfcliente.com.br`, um endereço só dele. O antigo `nfcliente.com.br/admin` leva para lá.
- **Página do cliente:** `cliente.nfcliente.com.br`. Abre só pelo link que você envia e só edita aquele perfil (veja *Link para o cliente editar*).
- **Banco e fotos:** o [Supabase](https://supabase.com) guarda clientes, perfis, imagens e o seu login. Hoje está no plano gratuito (veja *Plano do Supabase*).
- O endereço do chaveiro **nunca muda**. Você altera links, fotos e situação pelo painel e a página atualiza na hora.

### Situação de cada perfil

| Situação | O que o visitante vê | Quando usar |
|---|---|---|
| **Em configuração** | "Perfil indisponível" | Logo após "Ativar novo perfil", enquanto você monta a página |
| **No ar** | A página completa | Depois de clicar em "Liberar para o cliente" |
| **Desativado** | "Perfil indisponível" | Quando você quiser tirar do ar. **Nada é apagado** e dá para reativar com um clique |
| **Fora do ar · vencido** | "Perfil indisponível" | **Automático:** 3 dias depois do vencimento sem renovação. Ao renovar, volta na hora (veja *Vencimento*) |
| **Em teste** | A página completa | Depois de "Teste 3 dias": no ar hoje e mais 3 dias (veja *Teste grátis*) |
| **Teste não fechou** | "Perfil indisponível" | **Automático:** o teste acabou sem você clicar em "Efetivar" |
| **Excluído** | "Perfil indisponível" | Apaga página, links, fotos e dados internos, **sem volta**. Pede para digitar o link como confirmação |

Quem lê o chaveiro vê **a mesma mensagem** para link desativado, vencido, em configuração, excluído ou que nunca existiu. Assim ninguém descobre quais links existem (desde a v1.2.0).

### O que dá para configurar em cada perfil

- Foto de perfil e foto de fundo (redimensionadas automaticamente). As duas abrem a janela de ajuste: arrastar para posicionar, zoom e girar. A foto de perfil usa o círculo; a foto de fundo, uma moldura no formato da tela do celular, que é o espaço que ela ocupa na página (depois, ela se dissolve na cor da página). O botão **Ajustar**, na foto atual, reposiciona sem enviar de novo.
- Cor principal e tema escuro ou claro.
- Nome e descrição.
- Links, na ordem que você quiser. **Os 2 primeiros da lista aparecem em destaque**, como ícones abaixo da descrição; os demais aparecem como botões:
  - **WhatsApp** com mensagem pronta.
  - **Pix** com QR Code e Copia e Cola.
  - **Google:** avaliar, Maps e perfil da empresa.
  - **Contato:** e-mail, telefone e site.
  - **Link personalizado**, com ícone à sua escolha.
  - **16 redes sociais:** Instagram, TikTok, Facebook, YouTube, LinkedIn, X, Threads, Kwai e outras.
- Botões "Salvar contato" e "Compartilhar".
- **Cliente e cobrança** (só você vê): cliente ligado ao perfil, data de vencimento e observações. Perfis vencidos ficam destacados e têm um filtro próprio.

### Vencimento: o perfil sai do ar sozinho

Cada perfil pode ter uma data de **próximo vencimento**.

| Quando | Na página | No painel |
|---|---|---|
| Faltam 7 dias ou menos | Normal | "Vence em X dias", em laranja |
| Venceu, até 3 dias depois (carência) | Normal | "Venceu… sai do ar em…", em laranja |
| A partir do 4º dia | "Perfil indisponível" | Selo **Fora do ar · vencido**, em vermelho |

- **Renovar:** quando o cliente pagar, clique em **Renovar +1 mês**, na lista ou no perfil. O vencimento avança 1 mês a partir do vencimento anterior, e a página volta ao ar na hora. No campo de data do perfil, o botão **+1 mês** faz o mesmo e vale ao salvar.
- **Sem data de vencimento:** o perfil nunca sai do ar sozinho.
- **Desativado à mão:** continua desligado mesmo depois de renovar. Use **Reativar**.
- **Quem decide é o banco:** o próprio banco confere a data a cada acesso, no horário de Brasília. Não depende de nenhuma rotina agendada nem do painel aberto. Para mudar a carência, altere o `+ 3` em `public.perfil_vencido` (`supabase/schema.sql`) e `CARENCIA_DIAS` em `js/db.js`.

### Teste grátis (v1.5.0)

Para o cliente experimentar antes de fechar.

1. Num perfil **em configuração**, clique em **"Teste 3 dias"** (na lista) ou **"Liberar teste (3 dias)"** (no editor).
2. A página fica no ar hoje e mais 3 dias, com o selo **EM TESTE · até dd/mm**. Já dá para gerar o link para o cliente editar.
3. **Fechou?** Clique em **Efetivar**: a página fica no ar e vence daqui a 1 mês. Mudar o vencimento no editor também efetiva.
4. **Não fechou?** No fim do teste a página sai do ar sozinha e o perfil ganha o selo **TESTE NÃO FECHOU**. Nada é apagado: se o cliente voltar, é só **Efetivar**.

Os filtros **"Em teste"** e **"Teste não fechou"** mostram esses perfis. Eles ficam fora do filtro **"Vencidos"**, que é só para clientes pagantes atrasados.

### Clientes

Cada cliente tem um cadastro próprio, separado da página. Um cliente pode ter vários perfis.

- **Dados:** pessoa física ou jurídica, nome, CPF/CNPJ (com verificação dos dígitos e sem repetição), data de nascimento ou fundação.
- **Contato:** WhatsApp, telefone e e-mail.
- **Endereço:** o CEP preenche rua, bairro, cidade e UF.
- **Redes sociais e site.**
- **Plano, valor e observações.**
- **Foto na lista:** a bolinha do cliente mostra a foto do perfil ligado a ele. Com mais de um perfil, vale a do perfil no ar; se nenhum estiver no ar, a do primeiro perfil com foto. Sem foto, aparecem as iniciais. O cadastro do cliente não tem foto própria.

Ao criar um perfil para um cliente, a página já nasce com os contatos do cadastro: WhatsApp, e-mail, redes e site. No editor, o botão **"Trazer contatos do cadastro"** completa o que faltar.

O **endereço não entra sozinho**. Num chaveiro perdido ou numa coleira de pet, quem acha teria a chave **e** o endereço da casa. Para colocar o botão "Como chegar", marque **"Incluir também o endereço"** ao criar o perfil. A caixa vem desmarcada e só aparece quando o cadastro tem rua e cidade e "Já colocar na página os contatos" está marcada. Depois, também dá para adicionar um link do Google Maps no editor.

### Link para o cliente editar (v1.3.0)

O próprio cliente pode ajustar a página dele, sem acesso ao painel.

1. No painel, abra o perfil. No cartão **"Link para o cliente editar"**, clique em **Gerar link para o cliente**.
2. Na janela que abre, clique em **Copiar link** ou em **Enviar pelo WhatsApp**. A mensagem vai pronta para o WhatsApp do cadastro.
3. O cliente abre o link e digita o **PIN**: os **4 últimos dígitos do WhatsApp ou do telefone** do cadastro.

- **Para quem:** só para perfil **no ar**, **dentro do vencimento** e **ligado a um cliente**. Sem isso, o cartão explica o que falta.
- **Validade:** o link vale até você clicar em **Revogar link**. **Gerar novo link** cancela o anterior. O PIN é pedido **toda vez** que o link é aberto, e cada acesso dura 2 horas.
- **Bloqueio:** 5 PINs errados bloqueiam o link por 30 minutos.
- **O que o cliente muda:** aparência, informações da página, links e botões extras, incluindo foto e capa. Situação, vencimento, endereço do link e cadastro continuam só com você.
- **Quando vai ao ar:** só quando o cliente clica em **Salvar**.
- **Desfazer:** cada alteração, sua ou do cliente, guarda a versão anterior. No editor, o cartão **"Histórico de alterações"** mostra as últimas 15. **Carregar** põe a versão no editor; ela só vai ao ar quando você salvar.
- **Perfil desativado ou vencido:** o link para de funcionar na hora e volta a valer quando o perfil voltar ao ar.

### Painel do gestor (v1.7.0)

A aba **Gestor** reúne o que só o administrador mexe:

- **Segmentos:** a lista de tipos de negócio (Beleza, Pet, Academia…). Você inclui, renomeia e exclui. Excluir não apaga perfis: eles ficam "sem segmento".
- **Especialidades (v1.7.2):** dentro de cada segmento, os micro segmentos (ex.: Salão de Beleza → Lash Design, Manicure, Cabeleireira). Você inclui, renomeia e exclui no próprio cartão do segmento.
- **Segmento e especialidades nos perfis:** no editor do perfil, em "Cliente e cobrança": um segmento e as especialidades dele que o perfil faz. O cliente também escolhe no painel dele, só entre os da lista. A lista de perfis filtra por segmento e, depois, refina por especialidade (mostra quem tem qualquer uma das marcadas). O banco descarta sozinho especialidades de outro segmento.
- **Links e avisos:** por exemplo, o botão **"Chame o Suporte"** (link, e-mail ou só o número do WhatsApp) ou um aviso ("Manutenção sábado às 22h").
  - **Onde aparece (v1.7.3):** no painel em que o cliente edita a página, na **página do perfil** para os visitantes (sempre por último, depois dos botões do perfil, com a etiqueta "Patrocinado" se você marcar) ou nos dois. No painel do cliente, aparece o mesmo quadro da página, nas cores dela.
  - **Para quem:** todos os perfis, alguns segmentos (com refinamento opcional por especialidade) ou perfis escolhidos ("Marcar todos" ajuda).
  - **Quando sai do ar:** na primeira regra atingida — data e hora de fim, máximo de cliques por perfil (sai só daquele perfil) ou máximo de cliques no total (sai de todos). Pode ter data de início (fica "Agendado"). Sem regras, fica até você desligar.
  - **Cliques:** o Gestor mostra a situação (Ativo, Agendado, Encerrado por data ou por cliques), o total e o botão "Cliques" com a conta por perfil. O mesmo aparelho (endereço de internet) conta uma vez por hora; o banco guarda só um código embaralhado, nunca o endereço.
  - **Sem divulgação:** no cadastro do cliente, a caixa "Não exibir divulgação" esconde das páginas dele o que estiver marcado para a página do perfil.

### Acesso ao painel

- **Login** só para administradores, com mensagens claras para senha errada, e-mail não confirmado e excesso de tentativas.
- **"Esqueci minha senha"** envia um link por e-mail. A página `admin/redefinir-senha.html` cria a nova senha: mínimo de 8 caracteres, com letras e números.
- **"Minha conta"** troca a senha. A senha atual é conferida antes, e os outros aparelhos são desconectados.
- QR Code do perfil para imprimir no verso do chaveiro.

## Testar no computador

Precisa só do [Node.js](https://nodejs.org); não é preciso instalar mais nada.

```bash
node ferramentas/servidor-local.js --demo   # modo demonstração: nada vai para o banco
node ferramentas/servidor-local.js          # usa o Supabase de verdade (dados reais!)
```

| Endereço no computador | Como no site |
|---|---|
| `http://localhost:3000/<link>` | `nfcliente.com.br/<link>` (perfil) |
| `http://admin.localhost:3000/` | `admin.nfcliente.com.br` (painel) |
| `http://cliente.localhost:3000/#<código>` | `cliente.nfcliente.com.br` (página do cliente). Atalho: `http://localhost:3000/cliente/#<código>` |
| `http://localhost:3000/admin/` | Atalho só do computador: o mesmo painel no endereço do site. Use no modo demonstração, em que painel e perfis precisam do mesmo endereço |

O servidor local aplica as mesmas regras e cabeçalhos de segurança dos dois `.htaccess`: o da raiz para o site e o de `admin/` para o painel. Isso inclui `/<link>`, CSP e o bloqueio de arquivos internos. Assim, o que funciona nele funciona na Hostinger.

- **Modo demonstração (`--demo`):**
  - os dados ficam só no navegador;
  - qualquer e-mail e senha entram;
  - já vêm 3 perfis de exemplo, criados quando você abre o painel. Abra o painel antes de abrir um perfil.

  Nada é alterado em `js/config.js`.
- **Sem `--demo`:** o login e as alterações valem no banco de verdade, como no site.

## Supabase: o que já está pronto

O projeto **NFC Ambiente** já está configurado:

- **Banco:** tabelas `admins`, `admins_autorizados`, `clientes` e `perfis`, a função `perfil_publico` e o bucket `imagens`. O conteúdo está em [`supabase/schema.sql`](supabase/schema.sql).
- **Regras de acesso testadas no banco real:**
  - visitante só vê um perfil no ar, pelo link exato;
  - usuário logado que não é administrador não vê nada;
  - administrador vê e grava tudo.
- **E-mail autorizado como administrador:** `bru.teclas@gmail.com`. A conta com esse e-mail vira administradora sozinha quando é criada e confirmada.
- **`js/config.js`** já aponta para o projeto, com a chave **pública** (publishable).

## Supabase: configurações do painel

Essas opções não podem ser mudadas pelo banco. Elas foram feitas em outubro de 2026, em [supabase.com/dashboard](https://supabase.com/dashboard), no projeto **NFC Ambiente**. Confira de vez em quando e refaça tudo se criar um projeto novo:

1. **Authentication → URL Configuration**
   - **Site URL:** `https://nfcliente.com.br` ou, de preferência, `https://admin.nfcliente.com.br`. Os links dos e-mails funcionam com as duas, porque `nfcliente.com.br/admin/...` leva ao painel.
   - **Redirect URLs:** `https://admin.nfcliente.com.br/redefinir-senha.html`, mais as antigas `https://nfcliente.com.br/admin/redefinir-senha.html` e `http://localhost:3000/admin/redefinir-senha.html`.
2. **Authentication → Sign In / Providers**
   - Em **User Signups**:
     - desligue **"Allow new users to sign up"**. Ninguém cria conta sozinho; só entra quem você cadastrar;
     - desligue **"Allow anonymous sign-ins"**;
     - mantenha **"Confirm email"** ligado.
   - Em **Email**:
     - ligue **"Secure password change"** e **"Secure email change"**;
     - em **"Minimum password length"**, coloque `8`;
     - em **"Password requirements"**, escolha letras e números.
3. **Authentication → Emails → Templates.** Para cada modelo, copie o assunto, que está na 1ª linha do arquivo, e cole o conteúdo do arquivo:

   | Modelo | Arquivo |
   |---|---|
   | Reset password | `supabase/templates/recuperar-senha.html` |
   | Invite user | `supabase/templates/convite.html` |
   | Password changed (em *Security notifications*: ligue e cole) | `supabase/templates/senha-alterada.html` |

   Esses modelos levam para `admin/redefinir-senha.html`. O código do link só é usado quando você clica em "Salvar senha", então antivírus de e-mail que abrem links antes de você não o invalidam.
4. **Crie o seu acesso:** **Authentication → Users → Add user → Create new user**, com `bru.teclas@gmail.com`, uma senha forte e **"Auto Confirm User"** marcado. A conta vira administradora sozinha.
   Depois que o site estiver no ar, você também pode usar **"Send invitation"**: chega um e-mail para criar a senha.
5. **E-mail de verdade (recomendado):** o envio padrão do Supabase só entrega para e-mails da equipe do projeto e tem limite por hora. Para você, isso basta. Para mais administradores, configure um SMTP próprio em **Authentication → Emails → SMTP Settings**, por exemplo [Resend](https://resend.com) ou [Brevo](https://www.brevo.com), com remetente como `nao-responda@nfcliente.com.br`.

**Outro administrador:** no **SQL Editor**, rode `insert into public.admins_autorizados (email) values ('email@exemplo.com');` e depois convide o e-mail em **Users → Invite user**.

### Plano do Supabase

O projeto está no **plano gratuito**:

- **Pausa por inatividade:** o projeto pausa depois de cerca de **7 dias sem uso**. Enquanto estiver pausado, **todos os chaveiros param de funcionar**. Para reativar, entre no painel do Supabase e clique em *Restore project*.
- **Cotas:** há limite de tráfego (5 GB por mês, contando as fotos baixadas pelos visitantes) e de espaço para fotos (1 GB). Acompanhe em **Settings → Usage**.
- **Para não depender disso:** o **plano Pro** não pausa, tem backup diário e permite um limite de gastos (*spend cap*).

## Hospedagem (Hostinger: nfcliente.com.br, admin. e cliente.)

O site está publicado na Hostinger, no plano Premium (usuário `u253849728`), com SSL ativo nos três endereços e redirecionamento para HTTPS.

| Endereço | Pasta no servidor | Regras |
|---|---|---|
| `nfcliente.com.br` (site público) | `public_html` | `.htaccess` da raiz |
| `admin.nfcliente.com.br` (painel) | `public_html/painel-admin` (subdomínio) | `admin/.htaccess`, publicado como `painel-admin/.htaccess` |
| `cliente.nfcliente.com.br` (página do cliente) | `public_html/painel-cliente` (subdomínio) | `cliente/.htaccess`, publicado como `painel-cliente/.htaccess` |

- **Regras de endereço do site:**
  - `nfcliente.com.br/<link>` abre o perfil;
  - `/admin/...` leva para `admin.nfcliente.com.br/...` com os mesmos parâmetros, então links antigos e e-mails de senha continuam valendo;
  - tira o `www` e bloqueia arquivos que não são do site;
  - `/painel-admin` e `/painel-cliente` dão 404.
- **Regras do painel:**
  - só abre pelo endereço `admin.nfcliente.com.br`;
  - bloqueia arquivos PHP, como a página padrão da Hostinger, e arquivos ocultos;
  - pede aos buscadores para não indexar.
- **Regras da página do cliente:** as mesmas do painel, mas só pelo endereço `cliente.nfcliente.com.br` e com conexão só com o Supabase.
- **Cabeçalhos de segurança:** o `.htaccess` também envia:
  - **HSTS:** o navegador passa a usar sempre HTTPS;
  - **CSP:** a lista de onde o site pode carregar scripts, estilos, fotos e conexões.
  
  Se um dia o site precisar de outro serviço externo (por exemplo, fotos de outro endereço ou um script de estatísticas), inclua esse endereço na linha `Content-Security-Policy`. Sem isso, o navegador bloqueia.
- **O que vai para o servidor:** só o que está em `publicar/nfcliente-site.zip`. O pacote tem o site público na raiz, o painel em `painel-admin/` e a página do cliente em `painel-cliente/`. README, SQL, modelos de e-mail, `docs/` e `ferramentas/` ficam de fora.
- **O site público não recebe o código do painel:** nem o `db.js` nem a biblioteca de login do Supabase. As páginas dos perfis usam só `js/publico.js`.

### Atualizar o site

1. Gere o pacote de novo e faça commit:
   ```bash
   python3 publicar/montar-pacote.py
   git add -A && git commit -m "Atualiza o site" && git push
   ```
2. Na Hostinger, publique o pacote. Pelo hPanel: **Sites → nfcliente.com.br → Gerenciador de arquivos**, envie `nfcliente-site.zip` para `public_html` e extraia.
   Outra opção é pedir ao Claude ("publique de novo na Hostinger"). Ele clona o repositório numa pasta temporária do servidor e publica o pacote. **O pacote substitui o conteúdo do site**, mas preserva a pasta `painel-admin`, do subdomínio `admin.nfcliente.com.br` (conferido na publicação da v1.1.0). Para isso, Claude precisa de duas coisas:
   - o **conector da Hostinger** autorizado nas configurações de conectores do claude.ai;
   - acesso ao repositório. Se ele estiver privado, que é o recomendado, cadastre a **chave de implantação** (*deploy key*) da Hostinger no GitHub, em *Settings → Deploy keys*, só com leitura. A chave aparece no hPanel, em *Avançado → Git*.
3. Confira `https://admin.nfcliente.com.br` e um perfil. Para garantir a versão nova, use uma aba anônima.

> **Netlify e Vercel:** `_redirects` e `vercel.json` são da época em que o painel ficava em `/admin` no mesmo endereço e **não** foram adaptados à v1.2.0. Para usar outro serviço seria preciso:
> - publicar o painel num endereço próprio;
> - copiar os cabeçalhos de segurança dos dois `.htaccess`.
>
> A página pública apaga o login do painel guardado no endereço do site, então painel e perfis não podem dividir o mesmo endereço.
>
> GitHub Pages não serve, porque não consegue mandar `/<link>` para a página do perfil.

## Gravar o chaveiro
1. No painel: **Ativar novo perfil** → configure → **Liberar para o cliente**.
2. Copie o link do perfil.
3. No app **NFC Tools** (Android ou iPhone): *Escrever → Adicionar registro → URL* → cole o link → *Escrever* → encoste o chaveiro.
4. Teste com o celular. Depois, se quiser, trave a tag em *Outras → Bloquear tag*. É irreversível, mas como o link nunca muda isso não atrapalha.

> ⚠️ Use chaveiros **NFC NTAG213, 215 ou 216 (13,56 MHz)**. Chaveiros RFID de **125 kHz**, de portaria,
> **não** são lidos por celular.

## Backup

- **Código e documentação:** tudo fica no GitHub, no repositório `BruTeclas/NFCliente`, com o histórico completo das versões. Mantenha-o **privado** (*Settings → General → Danger Zone → Change visibility*). O resumo do que mudou em cada data está em [`docs/HISTORICO.md`](docs/HISTORICO.md).
- **Versões:** cada melhoria publicada ganha um número (`v1.0.0`, `v1.1.0`…) e um **ponto de restauração**, um branch `versao-X.Y.Z` no GitHub. Ele fica congelado com o site, a documentação e a estrutura do banco daquela versão. A lista está em [`docs/HISTORICO.md`](docs/HISTORICO.md).
- **Versão atual:** `v1.2.0`, no branch `versao-1.2.0`. As anteriores estão nos branches `versao-1.1.0` e `versao-1.0.0`.
- **Voltar a uma versão:** siga [`docs/RESTAURAR.md`](docs/RESTAURAR.md).
- **Opcional, com download em ZIP pelo GitHub:**
  1. Abra **Releases → Draft a new release**.
  2. Em **Choose a tag**, digite a versão (por exemplo `v1.0.0`) e escolha *Create new tag*.
  3. Em **Target**, escolha o branch `versao-1.0.0`.
  4. Clique em **Publish release**.
- **Dados de clientes:** **não** ficam no GitHub, nem mesmo com o repositório privado; o guia explica como guardá-los à parte.

## Estrutura dos arquivos

```
index.html            Página inicial do domínio (sua vitrine; personalize)
perfil.html           Página pública de cada perfil (/<link>)
admin/                Painel com login (publicado em admin.nfcliente.com.br, pasta painel-admin)
  index.html, admin.js, admin.css
  redefinir-senha.html, redefinir-senha.js  Página do link "Esqueci minha senha" e do convite
  .htaccess           Regras e cabeçalhos de segurança do painel
cliente/              Página do cliente (publicada em cliente.nfcliente.com.br, pasta painel-cliente)
  index.html, cliente.js, .htaccess
js/config.js          Endereço do Supabase, chave pública e domínios
js/editor-perfil.js   Editor do perfil, usado pelo painel e pela página do cliente
js/db.js              Acesso ao banco (Supabase ou modo demonstração). Só o painel usa
js/publico.js         Leitura de um perfil pela página pública (uma consulta, sem login)
js/perfil-render.js   Desenha a página do perfil, gera o Pix e o vCard
js/pagina-perfil.js   Carrega o perfil pelo link e mostra o aviso "Perfil indisponível"
js/lib/               Bibliotecas de terceiros com versão fixa (Supabase e QR Code) e suas licenças
css/perfil.css        Visual da página do perfil
supabase/schema.sql   Tabelas, regras de segurança e armazenamento de fotos
supabase/versoes/     Mudanças do banco de cada versão e os scripts para desfazer
supabase/functions/   Função cliente-imagem: recebe as fotos enviadas pelo cliente
supabase/templates/   Modelos de e-mail em português (recuperar senha, convite, senha alterada)
docs/RESTAURAR.md     Como voltar a uma versão anterior ou restaurar tudo do zero
docs/HISTORICO.md     O que mudou em cada versão
docs/IDEIAS.md        Caixa de ideias: próximas evoluções, ainda não desenvolvidas
ferramentas/servidor-local.js  Testar o site no computador com as regras da Hostinger
publicar/             Pacote do site para a Hostinger e o script que o gera
_redirects            Rotas para o Netlify
vercel.json           Rotas para a Vercel
```

## Segurança

- **Contas:** mantenha a verificação em duas etapas ligada no Gmail, no GitHub, na Hostinger e no Supabase. Quem entra em uma dessas contas controla o sistema.
- Visitantes só conseguem ler **um perfil pelo link exato** e **apenas se estiver no ar**. Não dá para listar perfis nem ver dados internos (função `perfil_publico`).
- **Clientes, perfis e fotos:** criar, editar e excluir exige login **e** estar na tabela `admins`. Visitantes e usuários comuns não veem nenhum dado de cliente.
- **Quem pode virar administrador:** a lista `admins_autorizados` só pode ser mudada pelo SQL Editor; nem um administrador consegue alterá-la pelo site. A promoção automática só vale para contas criadas pelo painel do Supabase (*Add user* ou *Invite user*) depois de o e-mail ser autorizado. Contas do cadastro público nunca viram administradoras.
- **Se o Supabase não carregar** (falha de internet ou bloqueador), o painel mostra um erro. Ele nunca cai no modo demonstração, que aceitaria qualquer senha.
- **Sessão:** o painel confere se a conta é administradora ao entrar e ao reabrir. Se não for, desconecta.
- **Link de nova senha:** vale uma vez, expira em 1 hora e é apagado da barra de endereço assim que a página abre.
- **Bibliotecas de terceiros:** o Supabase e o gerador de QR Code ficam dentro do site, em `js/lib/`, com a versão no nome do arquivo. Uma versão nova publicada por terceiros nunca entra sozinha. Para atualizar, baixe a nova versão (`npm pack @supabase/supabase-js@X.Y.Z`), troque o arquivo, ajuste o nome nas páginas e em `publicar/montar-pacote.py` e teste. A pasta não pode se chamar `vendor`: a publicação da Hostinger descarta pastas com esse nome.
- **Nenhum script embutido nas páginas:** todo o JavaScript fica em arquivos `.js`. Assim a CSP pode proibir scripts embutidos, que é o caminho mais comum de um ataque de injeção (XSS).
- **Painel em endereço próprio (`admin.nfcliente.com.br`):** o login fica guardado só nesse endereço. As páginas públicas (`nfcliente.com.br`) não têm acesso a ele, porque o navegador separa o armazenamento de cada endereço. Uma falha numa página pública não alcança a sessão do administrador.
- **Página pública sem código de login:**
  - as páginas dos perfis carregam só o necessário para mostrar o perfil;
  - fazem uma única consulta à função `perfil_publico`;
  - têm regras próprias e mais rígidas: nenhum formulário, nenhuma moldura e conexão só com o Supabase.
  - Ao abrir, elas também apagam qualquer login antigo do painel que tenha ficado guardado no endereço do site.
- **Resposta única:** link inexistente, desativado, vencido ou em configuração recebem a mesma resposta. Não dá para descobrir quais links existem.
- **Link do cliente:**
  - o banco guarda só o código embaralhado, e o link não dá acesso sem o PIN;
  - o cliente nunca recebe login nem acesso direto ao banco: cada ação passa por funções que conferem o acesso e só mexem naquele perfil;
  - tudo o que ele salva é conferido no banco: só os campos do editor, endereços `http(s)`, ícones da lista e fotos do próprio perfil;
  - fotos: até 3 MB, só JPG, PNG ou WebP (o conteúdo é conferido, não só o nome do arquivo), no máximo 30 por acesso.
- **Endereço do cliente:** só vai para a página se você marcar a caixa (veja *Clientes*).

## Próximas ideias

Ficam na caixa de ideias: [`docs/IDEIAS.md`](docs/IDEIAS.md).
