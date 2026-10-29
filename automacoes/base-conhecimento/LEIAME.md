# Base de conhecimento (n8n)

Automação que **guarda todo o diálogo** entre cliente e atendimento e **alimenta sozinha** um Google Doc de perguntas e respostas, que o agente de IA usa como fonte de conhecimento.

```
Chatwoot (conversa resolvida)
   └─► webhook ─► busca as mensagens ─► monta pares pergunta/resposta (sem dados pessoais)
                                         └─► Google Sheets, aba "Log"   (diálogo bruto, tudo)

Todo dia às 23h
   └─► lê o FAQ atual (Doc) + linhas "não processadas" do Log
        └─► IA agrupa o que se repete, ignora o que já está no FAQ
             └─► acrescenta ao Google Doc (só perguntas novas)
                  └─► marca as linhas do Log como processadas
```

Arquivo para importar: [`base-de-conhecimento.n8n.json`](base-de-conhecimento.n8n.json).

## Por que dois lugares

- **Planilha "Log"**: guarda *tudo*, para auditoria e para reprocessar depois.
- **Google Doc**: só o FAQ curado, sem repetição. É isso que o agente lê. Se o Doc virasse um despejo de conversas, o agente ficaria pior.

## Montagem (uns 15 minutos)

1. **Planilha**: crie uma planilha com a aba `Log` e a linha 1 exatamente assim:
   `data | conversa_id | pergunta | resposta | processado`
2. **Doc**: crie um Google Doc vazio (ex.: "FAQ NFCliente - Base de conhecimento").
3. **n8n**: *Workflows → Import from file* e escolha o JSON.
4. **Credenciais** (troque os `TROCAR` abrindo cada nó):
   - Google Sheets e Google Docs (OAuth2).
   - `Buscar mensagens`: *Header Auth* com nome `api_access_token` e o token do seu usuário do Chatwoot (Perfil → Token de acesso).
   - `IA: extrair perguntas frequentes`: *Header Auth* com nome `x-api-key` e a chave da Anthropic.
5. **IDs**: troque `1qpwCIAi-S0Y1MMVtNzcMVy-M1mWF0eMJLqF1NTvH9ro` e `1Tw2buygK3l0Z6dgH3Gunp8W4FIQkMsVfrN8o693xCIM` (o trecho entre `/d/` e `/edit` do link) nos nós do Sheets e do Docs.
6. **Configuração** (nó Set): ajuste `chatwoot_url` e `account_id`.
7. **Chatwoot**: *Configurações → Integrações → Webhooks* → adicione a URL de produção do nó `Chatwoot: conversa resolvida` e marque só o evento **Status da conversa alterado**.
8. Teste: resolva uma conversa de teste, veja a linha no `Log`, rode o fluxo da tarde manualmente e confira o Doc. Depois **ative** o workflow.

## Regras que a IA segue

Agrupa perguntas parecidas; mantém as que aparecem 2 vezes ou mais, ou dúvidas gerais úteis (preço, prazo, como usar, pagamento); ignora saudações e casos de um cliente só; não inventa preço nem prazo; pula o que já está no FAQ. Para mudar o critério, edite o texto em `Montar pedido à IA`.

## Privacidade

Antes de gravar no Log, o nó `Montar pares pergunta/resposta` troca e-mail, CPF, CNPJ e telefone por `[email]`, `[cpf]`, `[cnpj]`, `[telefone]`. Nomes próprios **não** são removidos pelo código; a IA é instruída a não repeti-los no FAQ. Se o Doc for ficar visível a terceiros, revise.

## Limites conhecidos

- O Doc só **cresce**: perguntas novas são acrescentadas, as existentes não são reescritas. Se uma resposta mudar (ex.: novo preço), corrija o Doc à mão.
- Cada rodada processa até 300 pares; o excedente fica para o dia seguinte.
- Não validei o fluxo dentro de um n8n real (sem acesso aqui). O código dos nós foi testado à parte; se algum nó pedir ajuste de campo ao importar (versões do n8n variam), é nos nós Google Docs/Sheets.
