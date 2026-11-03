import type { ChaveSecaoHome, LocalizacaoHome, SecaoHome } from "@/modules/busca";
import { CarrosselHome } from "./carrossel-home";
import { IconeHome, type NomeIconeHome } from "./icones-home";
import { CartaoPublico, dadosDeCardBusca, type DadosCard } from "./publico";

const ICONE_SECAO: Record<ChaveSecaoHome, NomeIconeHome> = {
  novidades: "megafone",
  mais_curtidos: "coracao",
  mais_indicados: "pessoas",
  na_sua_cidade: "local",
  em_alta_semana: "tendencia",
};

/** "Ver todos" leva à busca que já existe; as seções só têm perfis (D-018). Na sua cidade já filtra por cidade e UF. */
function destinoVerTodos(chave: ChaveSecaoHome, local: LocalizacaoHome | null): string {
  if (chave === "na_sua_cidade" && local) {
    const q = new URLSearchParams({ tipo: "perfil", uf: local.uf, cidade: local.cidade });
    return `/?${q.toString()}`;
  }
  return "/?tipo=perfil";
}

/** Seções em carrossel da home (IM-095): uma por seção retornada; seção sem itens não é desenhada. */
export function SecoesDaHome({
  secoes,
  urls,
  localizacao = null,
}: {
  secoes: readonly SecaoHome[];
  urls: Record<string, string>;
  localizacao?: LocalizacaoHome | null;
}) {
  const comItens = secoes.filter((s) => s.itens.length > 0);
  if (comItens.length === 0) return null;
  return (
    <div className="secoes-home" data-testid="secoes-home">
      {comItens.map((s) => (
        <CarrosselHome
          key={s.chave}
          titulo={s.titulo}
          icone={ICONE_SECAO[s.chave]}
          verTodos={destinoVerTodos(s.chave, localizacao)}
        >
          {s.itens.map((c) => {
            const dados = dadosDeCardBusca(c);
            return (
              <li key={dados.chave}>
                <CartaoPublico dados={dados} urls={urls} />
              </li>
            );
          })}
        </CarrosselHome>
      ))}
    </div>
  );
}

/**
 * Seções de catálogo da home (IM-019): empresas e profissionais, produtos e serviços, no mesmo carrossel e com o
 * mesmo card das demais. Seção sem itens mostra o aviso de vazio (não some, para o visitante saber que ainda não há nada).
 */
export function SecaoCatalogo({
  titulo,
  icone,
  verTodos,
  cards,
  urls,
  vazio,
}: {
  titulo: string;
  icone: NomeIconeHome;
  verTodos: string;
  cards: readonly DadosCard[];
  urls: Record<string, string>;
  vazio: string | null;
}) {
  if (cards.length === 0) {
    if (!vazio) return null;
    return (
      <div className="secao-home">
        <div className="secao-home-topo">
          <h2>
            <IconeHome nome={icone} tamanho={26} className="secao-home-icone" />
            {titulo}
          </h2>
        </div>
        <p className="ajuda">{vazio}</p>
      </div>
    );
  }
  return (
    <CarrosselHome titulo={titulo} icone={icone} verTodos={verTodos}>
      {cards.map((d) => (
        <li key={d.chave}>
          <CartaoPublico dados={d} urls={urls} />
        </li>
      ))}
    </CarrosselHome>
  );
}
