/*
 * CONFIGURAÇÃO DO SITE
 * ---------------------------------------------------------------------------
 * Projeto Supabase: "NFC Ambiente" (Supabase > Project Settings > API).
 * Com supabaseUrl vazio, o site roda em MODO DEMONSTRAÇÃO: tudo fica salvo
 * só no navegador, para testar o painel.
 *
 * A chave abaixo é a chave PÚBLICA (publishable). Ela vai para o navegador de
 * qualquer visitante por natureza; quem protege os dados são as regras do banco
 * (supabase/schema.sql). NUNCA coloque aqui a chave secreta (secret/service_role).
 */
window.CONFIG = {
  supabaseUrl: "https://vomhyqdvxhkovykipxpg.supabase.co",
  supabaseAnonKey: "sb_publishable_Y47eJPltAJ5QH4j1S4ol8g_K7sWYsvs",

  // Endereço público do site, usado nos links e QR Codes dos perfis.
  // Vazio = usa o endereço atual do navegador.
  dominio: "https://nfcliente.com.br",

  // Página em que o cliente edita o próprio perfil (link de configuração, v1.3.0).
  dominioCliente: "https://cliente.nfcliente.com.br",

  marca: "NFCliente",

  // Crédito no rodapé de todos os perfis. O nome vira link para "url".
  // Use credito: null para não mostrar nada.
  credito: { texto: "Desenvolvido por", nome: "FrontIA", url: "https://frontia.com.br/" }
};
