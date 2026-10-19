# Caixa de ideias

Próximas evoluções do NFCliente. **Nada aqui está em desenvolvimento**: é a lista para decidir o que fazer depois. Quando uma ideia for feita, ela sai daqui e vai para o [`HISTORICO.md`](HISTORICO.md).

## 1. Perfis empresariais (várias tags para uma empresa)

**A ideia:** fechar com uma empresa que contrata várias tags, por exemplo uma para cada vendedor do time comercial.

**O que precisa:**
- Cadastro da **empresa**, com os **perfis/tags** dela agrupados.
- Gestão da empresa num lugar só: ver todas as tags, quais estão no ar, cobrança e vencimento.
- Encontrar essas tags por um **filtro** (por empresa) ou dentro de um **perfil único da empresa com várias tags**.

**A decidir:**
- Cada vendedor tem a própria página, a empresa tem uma página só, ou as duas coisas (página da empresa com a lista do time)?
- A cobrança é da empresa (um valor para todas as tags) ou por tag?
- A empresa ganha um link para editar as páginas do time, como o link do cliente da v1.3.0?

## 2. Venda de propaganda

**A ideia:** uma área para vender anúncios. Um cliente pode anunciar dentro do sistema.

**O que precisa:**
- Página para **ativar uma propaganda**.
- **Período** da propaganda (início e fim).
- **Quantas vezes** ela aparece.
- **Raio** de onde ela aparece (região).
- **Tipos de cliente** em que ela aparece (segmentação).

**A decidir:**
- Onde o anúncio aparece: nas páginas dos perfis, no mapa (ideia 3) ou nos dois?
- Como cobrar: por período, por quantidade de exibições ou por cliques?
- O anunciante monta o anúncio sozinho (com aprovação sua) ou é você quem cadastra?
- Contar exibições e cliques para mostrar o resultado ao anunciante.
- Os donos das páginas aceitam anúncios na página deles? Talvez o plano mais barato tenha anúncio e o plano pago não.

## 3. Mapa de serviços ("Encontre serviços perto de você")

**A ideia:** um mapa interativo com os clientes cadastrados, pelo endereço e pelo tipo de serviço.

**Como funciona:**
- Um botão **"Encontre serviços perto de você"** abre o mapa.
- A pessoa filtra **por lista ou no mapa**, **por tipo de serviço** e **por raio** (distância).
- Ao clicar no nome ou no ponto do mapa, abre o **perfil** do cliente.
- Só aparecem no mapa os clientes que **pagam a mais** por isso (serviço à parte).

**A decidir:**
- Onde fica o botão: na página inicial do site, em todas as páginas de perfil ou nos dois?
- Lista de tipos de serviço (cílios, pet, academia, restaurante…): fixa ou você cadastra?
- Mostrar o endereço exato ou só a região? Para quem atende em casa, o ponto exato expõe o endereço residencial.
- Localização da pessoa: pedir permissão ao navegador ou ela digita o CEP.
- Serviço de mapa: há opções gratuitas (OpenStreetMap), mas a conversão de endereço em ponto do mapa tem limite de uso.

## 4. Estatísticas

- Quantas vezes cada chaveiro foi lido e quais botões foram mais clicados.
- Um relatório simples para o cliente ver o resultado da página dele.

## 5. Cobrança automática

- Link de pagamento (Mercado Pago ou Asaas) que renova o vencimento sozinho quando o cliente paga.

## 6. Modelos prontos por segmento

- Páginas de partida para salão, restaurante, pet (coleira), emergência médica, corretor.

## 7. Próximos itens do painel do gestor

A aba "Gestor" começou na v1.7.0 com segmentos e avisos. Ideias para as próximas versões:

- **Resumo do negócio:** perfis no ar, em teste, testes não fechados (taxa de conversão) e receita mensal.
- **Cobrança da semana:** quem vence nos próximos 7 dias, com botão de WhatsApp e mensagem pronta.
- **Configurações gerais:** WhatsApp de suporte, rodapé das páginas ("Desenvolvido por…"), dias de carência e de teste, mensagem padrão do link do cliente.
- **Planos:** cadastrar planos (nome, valor, período) e escolher no cliente.
- **Modelos de página por segmento** (ideia 6).
- **Administradores:** ver quem tem acesso ao painel.
- **Links nas páginas públicas:** mostrar links do administrador também para os visitantes (hoje os avisos só aparecem no painel do cliente).
