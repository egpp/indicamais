import { crc32, deflateSync } from "node:zlib";

/** Gera um PNG RGB real (válido) de cor sólida com uma faixa mais escura, sem dependências. Pequeno (poucos KB). */
export function gerarPng(
  largura: number,
  altura: number,
  [r, g, b]: [number, number, number],
): Buffer {
  const linhas: Buffer[] = [];
  for (let y = 0; y < altura; y++) {
    const linha = Buffer.alloc(1 + largura * 3);
    const faixa = y > altura * 0.4 && y < altura * 0.6;
    for (let x = 0; x < largura; x++) {
      linha[1 + x * 3] = faixa ? r >> 1 : r;
      linha[2 + x * 3] = faixa ? g >> 1 : g;
      linha[3 + x * 3] = faixa ? b >> 1 : b;
    }
    linhas.push(linha);
  }
  const bloco = (tipo: string, dados: Buffer) => {
    const t = Buffer.from(tipo, "ascii");
    const tam = Buffer.alloc(4);
    tam.writeUInt32BE(dados.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, dados])) >>> 0);
    return Buffer.concat([tam, t, dados, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; // 8 bits por canal
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco("IHDR", ihdr),
    bloco("IDAT", deflateSync(Buffer.concat(linhas))),
    bloco("IEND", Buffer.alloc(0)),
  ]);
}
