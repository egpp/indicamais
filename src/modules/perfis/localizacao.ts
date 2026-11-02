import { z } from "zod";
import { classificarErroBanco } from "@/shared/conteudo/erros-banco";
import type {
  ErroBanco,
  Resultado as ResultadoBase,
  RespostaBanco,
} from "@/shared/conteudo/resultado";
import { uuidSchema } from "@/shared/conteudo/zod-util";
import type { EntradaGeocodificacao, ResultadoGeocodificacao } from "@/shared/geocodificacao";
import { erroPerfis, MENSAGENS_PERFIS, type ErroPerfis } from "./erros";

/**
 * Localização da página do negócio (D-016; IM-018, IM-092): coordenadas por versão e mostrar_mapa.
 * Regras confirmadas em 02/11/2026: a coordenada só vale com a versão aprovada (o banco decide); mostrar_mapa
 * não passa por aprovação; coordenada 'informado' à mão é permitida. Geocodificação só no servidor
 * (Nominatim, sem guardar nada além da coordenada). Falha de geocodificação NUNCA quebra o salvar do perfil:
 * o resultado é neutro (`localizado: false`) e o mapa simplesmente não aparece. O endereço nunca vai para log.
 * Nada aqui toca em pontos, comissões ou relacionamento (IM-042, IM-059, IM-065).
 */

export const MENSAGENS_LOCALIZACAO = {
  coordenadasInvalidas: "Informe latitude entre -90 e 90 e longitude entre -180 e 180.",
  semEndereco: "Preencha endereço, cidade e UF para localizar no mapa.",
  versaoRejeitada: "Esta versão foi rejeitada e não recebe localização.",
  indisponivel: "Não foi possível localizar o endereço agora. A página segue sem mapa.",
} as const;

// ---------------------------------------------------------------- Zod

export const LIMITES_BRASIL = { latMin: -34, latMax: 6, lonMin: -74, lonMax: -34 } as const;

export const coordenadasSchema = z.object({
  latitude: z
    .number({ error: MENSAGENS_LOCALIZACAO.coordenadasInvalidas })
    .finite({ error: MENSAGENS_LOCALIZACAO.coordenadasInvalidas })
    .min(-90, { error: MENSAGENS_LOCALIZACAO.coordenadasInvalidas })
    .max(90, { error: MENSAGENS_LOCALIZACAO.coordenadasInvalidas }),
  longitude: z
    .number({ error: MENSAGENS_LOCALIZACAO.coordenadasInvalidas })
    .finite({ error: MENSAGENS_LOCALIZACAO.coordenadasInvalidas })
    .min(-180, { error: MENSAGENS_LOCALIZACAO.coordenadasInvalidas })
    .max(180, { error: MENSAGENS_LOCALIZACAO.coordenadasInvalidas }),
});
export type Coordenadas = z.infer<typeof coordenadasSchema>;

/** Valores do Brasil são esperados; fora disso só se avisa (a gravação segue). */
export function foraDoBrasil({ latitude, longitude }: Coordenadas): boolean {
  return (
    latitude < LIMITES_BRASIL.latMin ||
    latitude > LIMITES_BRASIL.latMax ||
    longitude < LIMITES_BRASIL.lonMin ||
    longitude > LIMITES_BRASIL.lonMax
  );
}

// ---------------------------------------------------------------- URLs do mapa (função pura)

export type MapaUrls = {
  /** iframe: mapa incorporado com marcador. */
  embed: string;
  /** "Ver mapa maior". */
  verMaior: string;
  /** "Como chegar". */
  comoChegar: string;
};

const DELTA_EMBED = 0.005;
const num = (n: number) => String(Number(n.toFixed(6)));

/**
 * Monta as URLs do OpenStreetMap. Só números finitos na faixa válida entram na URL (nunca texto livre);
 * entrada inválida devolve null e o mapa não aparece.
 */
export function montarMapaUrls(entrada: {
  latitude: unknown;
  longitude: unknown;
}): MapaUrls | null {
  const r = coordenadasSchema.safeParse(entrada);
  if (!r.success) return null;
  const lat = num(r.data.latitude);
  const lon = num(r.data.longitude);
  const d = DELTA_EMBED;
  const bbox = [
    num(r.data.longitude - d),
    num(r.data.latitude - d),
    num(r.data.longitude + d),
    num(r.data.latitude + d),
  ].join(",");
  return {
    embed: `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`,
    verMaior: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`,
    comoChegar: `https://www.openstreetmap.org/directions?to=${encodeURIComponent(`${lat},${lon}`)}`,
  };
}

// ---------------------------------------------------------------- Modelos

export type LinhaLocalizacao = {
  latitude: number | null;
  longitude: number | null;
  mostrar_mapa: boolean | null;
};
export type LocalizacaoMeuPerfil = {
  latitude: number | null;
  longitude: number | null;
  mostrarMapa: boolean;
  urls: MapaUrls | null;
};
/** O que a vitrine consome: null = sem mapa (desligado, sem coordenada ou coordenada inválida). */
export type MapaPublico = { latitude: number; longitude: number; urls: MapaUrls };

export function paraLocalizacaoMeuPerfil(l: LinhaLocalizacao): LocalizacaoMeuPerfil {
  const tem = l.latitude !== null && l.longitude !== null;
  return {
    latitude: l.latitude,
    longitude: l.longitude,
    mostrarMapa: l.mostrar_mapa === true,
    urls: tem ? montarMapaUrls({ latitude: l.latitude, longitude: l.longitude }) : null,
  };
}

export function paraMapaPublico(l: LinhaLocalizacao | null): MapaPublico | null {
  if (!l || l.mostrar_mapa !== true || l.latitude === null || l.longitude === null) return null;
  const urls = montarMapaUrls({ latitude: l.latitude, longitude: l.longitude });
  return urls ? { latitude: l.latitude, longitude: l.longitude, urls } : null;
}

// ---------------------------------------------------------------- Erros

type Operacao = "localizar" | "informar" | "limpar" | "mostrar" | "ler";

/** 42501 (perfil alheio/conta sem acesso), 22023 (dado inválido), P0002, P0001. Texto do banco nunca sai. */
export function mapearErroBancoLocalizacao(e: ErroBanco, operacao: Operacao): ErroPerfis {
  const M = MENSAGENS_PERFIS;
  switch (classificarErroBanco(e)) {
    case "PERMISSAO":
      return erroPerfis("SEM_PERMISSAO", M.semPermissao);
    case "DADO_INVALIDO":
      return erroPerfis(
        "VALIDACAO",
        operacao === "informar" || operacao === "localizar"
          ? MENSAGENS_LOCALIZACAO.coordenadasInvalidas
          : M.textoInvalido,
      );
    case "NAO_ENCONTRADO":
    case "REFERENCIA":
      return erroPerfis("NAO_ENCONTRADO", M.naoEncontrado);
    case "ESTADO_INVALIDO":
      return erroPerfis("ESTADO_INVALIDO", M.emAnalise);
    default:
      return erroPerfis("ERRO_INTERNO", M.generica);
  }
}

// ---------------------------------------------------------------- Serviço

export type Resultado<T> = ResultadoBase<T, ErroPerfis>;
type OrigemCoordenada = "geocodificado" | "informado";

/**
 * Banco injetado (sessão do usuário; NUNCA service_role). Migração 20261102190000.
 * Adaptador: src/app/_lib/banco-localizacao.ts.
 */
export interface ClienteBancoLocalizacao {
  /** select endereco, cidade, uf em perfis_perfil_versao por id (RLS: só o dono). `dados: null` = não é meu. */
  lerEnderecoVersao(versaoId: string): Promise<RespostaBanco<EntradaGeocodificacao | null>>;
  /** rpc perfis_gravar_coordenadas. */
  gravarCoordenadas(
    versaoId: string,
    latitude: number,
    longitude: number,
    origem: OrigemCoordenada,
  ): Promise<{ erro: ErroBanco | null }>;
  /** rpc perfis_limpar_coordenadas. */
  limparCoordenadas(versaoId: string): Promise<{ erro: ErroBanco | null }>;
  /** rpc perfis_definir_mostrar_mapa. */
  definirMostrarMapa(perfilId: string, mostrar: boolean): Promise<{ erro: ErroBanco | null }>;
  /** select em perfis_meus_perfis (latitude, longitude, mostrar_mapa). */
  lerMeuMapa(perfilId: string): Promise<RespostaBanco<LinhaLocalizacao>>;
  /** select em perfis_perfil_publico (latitude, longitude, mostrar_mapa). */
  lerMapaPublico(perfilId: string): Promise<RespostaBanco<LinhaLocalizacao>>;
}

export type DependenciasLocalizacao = {
  geocodificar: (e: EntradaGeocodificacao) => Promise<ResultadoGeocodificacao>;
};

const falha = (erro: ErroPerfis): { ok: false; erro: ErroPerfis } => ({ ok: false, erro });
const invalido = (mensagem: string) =>
  falha(erroPerfis("VALIDACAO", mensagem, { campos: { _: mensagem } }));

export function criarServicoLocalizacao(
  banco: ClienteBancoLocalizacao,
  deps: DependenciasLocalizacao,
) {
  async function seguro<T>(f: () => Promise<Resultado<T>>): Promise<Resultado<T>> {
    try {
      return await f();
    } catch {
      return falha(erroPerfis("ERRO_INTERNO", MENSAGENS_PERFIS.generica));
    }
  }

  return {
    /**
     * Lê endereço/cidade/UF da versão do próprio perfil, geocodifica no servidor e grava com origem
     * 'geocodificado'. Sem endereço, sem resultado ou geocodificador fora do ar: `localizado: false`, sem erro
     * (o salvar do perfil não quebra). Erro só quando o banco recusa (perfil alheio, conta suspensa, rejeitada).
     */
    localizarVersao(versaoId: string) {
      return seguro<{ localizado: boolean }>(async () => {
        const id = uuidSchema.safeParse(versaoId);
        if (!id.success) return falha(erroPerfis("NAO_ENCONTRADO", MENSAGENS_PERFIS.naoEncontrado));
        const lido = await banco.lerEnderecoVersao(id.data);
        if (lido.erro) return falha(mapearErroBancoLocalizacao(lido.erro, "ler"));
        if (!lido.dados) return falha(erroPerfis("NAO_ENCONTRADO", MENSAGENS_PERFIS.naoEncontrado));
        const { endereco, cidade, uf } = lido.dados;
        if (!endereco?.trim() || !cidade?.trim() || !uf?.trim()) {
          return { ok: true, valor: { localizado: false } };
        }
        const geo = await deps.geocodificar({ endereco, cidade, uf });
        if (!geo.ok) return { ok: true, valor: { localizado: false } };
        const c = coordenadasSchema.safeParse({ latitude: geo.latitude, longitude: geo.longitude });
        if (!c.success) return { ok: true, valor: { localizado: false } };
        const g = await banco.gravarCoordenadas(
          id.data,
          c.data.latitude,
          c.data.longitude,
          "geocodificado",
        );
        if (g.erro) return falha(mapearErroBancoLocalizacao(g.erro, "localizar"));
        return { ok: true, valor: { localizado: true } };
      });
    },

    /** Coordenada à mão (origem 'informado'). Fora do Brasil só avisa. */
    informarCoordenadas(versaoId: string, latitude: unknown, longitude: unknown) {
      return seguro<{ ok: true; avisoForaDoBrasil: boolean }>(async () => {
        const id = uuidSchema.safeParse(versaoId);
        if (!id.success) return falha(erroPerfis("NAO_ENCONTRADO", MENSAGENS_PERFIS.naoEncontrado));
        const c = coordenadasSchema.safeParse({ latitude, longitude });
        if (!c.success) return invalido(MENSAGENS_LOCALIZACAO.coordenadasInvalidas);
        const g = await banco.gravarCoordenadas(
          id.data,
          c.data.latitude,
          c.data.longitude,
          "informado",
        );
        if (g.erro) return falha(mapearErroBancoLocalizacao(g.erro, "informar"));
        return { ok: true, valor: { ok: true, avisoForaDoBrasil: foraDoBrasil(c.data) } };
      });
    },

    limparCoordenadas(versaoId: string) {
      return seguro<{ ok: true }>(async () => {
        const id = uuidSchema.safeParse(versaoId);
        if (!id.success) return falha(erroPerfis("NAO_ENCONTRADO", MENSAGENS_PERFIS.naoEncontrado));
        const r = await banco.limparCoordenadas(id.data);
        if (r.erro) return falha(mapearErroBancoLocalizacao(r.erro, "limpar"));
        return { ok: true, valor: { ok: true } };
      });
    },

    /** Liga/desliga o mapa. Não passa por aprovação (confirmado em 02/11/2026). */
    definirMostrarMapa(perfilId: string, mostrar: boolean) {
      return seguro<{ ok: true }>(async () => {
        const id = uuidSchema.safeParse(perfilId);
        if (!id.success) return falha(erroPerfis("NAO_ENCONTRADO", MENSAGENS_PERFIS.naoEncontrado));
        if (typeof mostrar !== "boolean") return invalido(MENSAGENS_PERFIS.textoInvalido);
        const r = await banco.definirMostrarMapa(id.data, mostrar);
        if (r.erro) return falha(mapearErroBancoLocalizacao(r.erro, "mostrar"));
        return { ok: true, valor: { ok: true } };
      });
    },

    /** Localização do meu perfil (painel). */
    lerMinhaLocalizacao(perfilId: string) {
      return seguro<LocalizacaoMeuPerfil>(async () => {
        const id = uuidSchema.safeParse(perfilId);
        if (!id.success) return falha(erroPerfis("NAO_ENCONTRADO", MENSAGENS_PERFIS.naoEncontrado));
        const r = await banco.lerMeuMapa(id.data);
        if (r.erro) return falha(mapearErroBancoLocalizacao(r.erro, "ler"));
        if (!r.dados) return falha(erroPerfis("NAO_ENCONTRADO", MENSAGENS_PERFIS.naoEncontrado));
        return { ok: true, valor: paraLocalizacaoMeuPerfil(r.dados) };
      });
    },

    /** Mapa da vitrine: `null` = não mostrar a seção de mapa. */
    lerMapaPublico(perfilId: string) {
      return seguro<MapaPublico | null>(async () => {
        const id = uuidSchema.safeParse(perfilId);
        if (!id.success) return { ok: true, valor: null };
        const r = await banco.lerMapaPublico(id.data);
        if (r.erro) return falha(mapearErroBancoLocalizacao(r.erro, "ler"));
        return { ok: true, valor: paraMapaPublico(r.dados) };
      });
    },
  };
}

export type ServicoLocalizacao = ReturnType<typeof criarServicoLocalizacao>;
