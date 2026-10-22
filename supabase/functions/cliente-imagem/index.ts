// NFCliente · Envio de foto pelo próprio cliente (cliente.nfcliente.com.br)
// POST com a imagem no corpo e os cabeçalhos:
//   x-sessao: acesso do cliente (recebido depois do PIN)   x-tipo: "foto", "capa" ou "galeria" (v1.7.6)
// Confere o acesso no banco (cliente_autorizar_envio, até 30 envios por acesso), aceita só
// JPEG, PNG ou WEBP de até 3 MB e grava na pasta do próprio perfil no bucket "imagens".
const URL_SUPABASE = Deno.env.get("SUPABASE_URL")!;
const CHAVE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORIGENS = ["https://cliente.nfcliente.com.br"];
const TIPOS: Record<string, { ext: string; assinatura: (b: Uint8Array) => boolean }> = {
  "image/webp": { ext: "webp", assinatura: (b) => b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45 },
  "image/jpeg": { ext: "jpg", assinatura: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/png": { ext: "png", assinatura: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
};

Deno.serve(async (req) => {
  const origem = req.headers.get("origin") ?? "";
  const cors = {
    "Access-Control-Allow-Origin": ORIGENS.includes(origem) ? origem : ORIGENS[0],
    "Access-Control-Allow-Headers": "content-type, x-sessao, x-tipo, apikey, authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  const resposta = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return resposta({ erro: "metodo" }, 405);

  const sessao = req.headers.get("x-sessao") ?? "";
  const tipo = req.headers.get("x-tipo") ?? "";
  const formato = TIPOS[(req.headers.get("content-type") ?? "").split(";")[0].trim()];
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(sessao) || !["foto", "capa", "galeria"].includes(tipo) || !formato) return resposta({ erro: "pedido" }, 400);

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length < 12 || bytes.length > 3 * 1024 * 1024) return resposta({ erro: "tamanho" }, 413);
  if (!formato.assinatura(bytes)) return resposta({ erro: "formato" }, 415);

  const cab = { apikey: CHAVE, Authorization: `Bearer ${CHAVE}` };
  const aut = await fetch(`${URL_SUPABASE}/rest/v1/rpc/cliente_autorizar_envio`, {
    method: "POST", headers: { ...cab, "Content-Type": "application/json" }, body: JSON.stringify({ p_sessao: sessao }),
  });
  const perfilId = aut.ok ? await aut.json() : null;
  if (typeof perfilId !== "string" || !/^[0-9a-f-]{36}$/.test(perfilId)) return resposta({ erro: "sessao" }, 401);

  const caminho = `${perfilId}/cliente-${tipo}-${Date.now()}.${formato.ext}`;
  const envio = await fetch(`${URL_SUPABASE}/storage/v1/object/imagens/${caminho}`, {
    method: "POST",
    headers: { ...cab, "Content-Type": req.headers.get("content-type")!.split(";")[0], "Cache-Control": "max-age=31536000", "x-upsert": "false" },
    body: bytes,
  });
  if (!envio.ok) return resposta({ erro: "envio" }, 500);
  return resposta({ url: `${URL_SUPABASE}/storage/v1/object/public/imagens/${caminho}` });
});
