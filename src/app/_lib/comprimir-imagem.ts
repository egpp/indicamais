/**
 * Compressão simples no navegador antes do envio (limite de 2 MB por imagem, D-006). Reduz o lado maior a
 * 1600 px e recodifica em WebP. Também descarta metadados da câmera (localização, modelo). Se o navegador não
 * suportar ou algo falhar, devolve o arquivo original (o limite de tamanho é conferido depois).
 */
const LADO_MAX = 1600;
const PULAR_ABAIXO_BYTES = 300 * 1024;
const TIPOS_SAIDA = ["image/webp", "image/jpeg", "image/png"];

export async function comprimirImagem(arquivo: Blob): Promise<Blob> {
  if (arquivo.size <= PULAR_ABAIXO_BYTES) return arquivo;
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return arquivo;
  try {
    const bitmap = await createImageBitmap(arquivo);
    const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * escala));
    canvas.height = Math.max(1, Math.round(bitmap.height * escala));
    const ctx = canvas.getContext("2d");
    if (!ctx) return arquivo;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const saida = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.82));
    if (saida && TIPOS_SAIDA.includes(saida.type) && saida.size < arquivo.size) return saida;
    return arquivo;
  } catch {
    return arquivo;
  }
}
