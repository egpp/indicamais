import type { SecaoHome } from "@/modules/busca";
import { CarrosselHome } from "./carrossel-home";
import { CartaoPublico, dadosDeCardBusca } from "./publico";

/** Seções em carrossel da home (IM-095): uma por seção retornada; seção sem itens não é desenhada. */
export function SecoesDaHome({
  secoes,
  urls,
}: {
  secoes: readonly SecaoHome[];
  urls: Record<string, string>;
}) {
  const comItens = secoes.filter((s) => s.itens.length > 0);
  if (comItens.length === 0) return null;
  return (
    <div className="secoes-home" data-testid="secoes-home">
      {comItens.map((s) => (
        <CarrosselHome key={s.chave} titulo={s.titulo}>
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
