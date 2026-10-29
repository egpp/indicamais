import {
  criarServicoPatrocinadores,
  type ClienteBancoPatrocinadores,
  type ServicoPatrocinadores,
} from "@/modules/administracao";
import { criarServicoBusca, type ClienteBancoBusca, type ServicoBusca } from "@/modules/busca";
import { criarClientePublico } from "@/shared/supabase/publico";
import {
  criarBancoBusca,
  criarBancoLeituraPublica,
  criarBancoPatrocinadores,
} from "./bancos-supabase";
import { criarAssinadorImagens } from "./imagens-servidor";
import {
  criarLeituraPublica,
  type ClienteBancoLeituraPublica,
  type LeituraPublica,
} from "./leitura-publica";

export type DependenciasPublicas = {
  bancoBusca: ClienteBancoBusca;
  bancoPatrocinadores: ClienteBancoPatrocinadores;
  bancoLeitura: ClienteBancoLeituraPublica;
  /** URL assinada (curta, gerada no servidor) por caminho. Nunca devolve metadado do objeto (owner). */
  assinarImagens: (caminhos: string[]) => Promise<Record<string, string>>;
};

export type ContextoPublico = {
  busca: ServicoBusca;
  patrocinadores: ServicoPatrocinadores;
  leitura: LeituraPublica;
  assinarImagens: (caminhos: string[]) => Promise<Record<string, string>>;
};

/** Serviços das páginas públicas sobre os bancos injetados (reais com o cliente anônimo; falsos nos testes). */
export function criarContextoPublico(d: DependenciasPublicas): ContextoPublico {
  return {
    busca: criarServicoBusca(d.bancoBusca),
    patrocinadores: criarServicoPatrocinadores(d.bancoPatrocinadores),
    leitura: criarLeituraPublica(d.bancoLeitura),
    assinarImagens: async (c) => {
      try {
        return await d.assinarImagens(c);
      } catch {
        return {};
      }
    },
  };
}

/** Contexto de uma requisição pública: sessão ANÔNIMA, sem cookies, sem service_role. */
export function obterContextoPublico(): ContextoPublico {
  const supabase = criarClientePublico();
  return criarContextoPublico({
    bancoBusca: criarBancoBusca(supabase),
    bancoPatrocinadores: criarBancoPatrocinadores(supabase),
    bancoLeitura: criarBancoLeituraPublica(supabase),
    assinarImagens: criarAssinadorImagens(supabase),
  });
}
