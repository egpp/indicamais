import Link from "next/link";
import { FormHabilitarEstilo } from "./form-aparencia";
import { SeloEstado } from "./painel";
import {
  caminhoImagemCompleta,
  caminhoPrevia,
  contarModelos,
  filtrarModelos,
  rotuloContagem,
  type FiltroModelos,
  type ModeloNaTela,
} from "./estilos-admin";
import "./modelos-lista.css";

const ABAS: { filtro: FiltroModelos; rotulo: string }[] = [
  { filtro: "todos", rotulo: "Todos" },
  { filtro: "habilitados", rotulo: "Habilitados" },
  { filtro: "desabilitados", rotulo: "Desabilitados" },
];

function endereco(filtro: FiltroModelos, busca: string): string {
  const p = new URLSearchParams();
  if (filtro !== "todos") p.set("estado", filtro);
  if (busca) p.set("busca", busca);
  const s = p.toString();
  return s ? `/administracao/estilos?${s}` : "/administracao/estilos";
}

/** Tela "Modelos de sites": contadores, busca, filtro por situação, índice recolhível e cartões com prévia. */
export function ListaModelos({
  modelos,
  filtro,
  busca,
}: {
  modelos: readonly ModeloNaTela[];
  filtro: FiltroModelos;
  busca: string;
}) {
  const contagem = contarModelos(modelos);
  const visiveis = filtrarModelos(modelos, filtro, busca);
  return (
    <div className="modelos">
      <dl className="modelos-contadores">
        <div>
          <dt>Total</dt>
          <dd>{contagem.total}</dd>
        </div>
        <div className="modelos-contador-verde">
          <dt>Habilitados</dt>
          <dd>{contagem.habilitados}</dd>
        </div>
        <div>
          <dt>Desabilitados</dt>
          <dd>{contagem.desabilitados}</dd>
        </div>
      </dl>

      <form method="get" action="/administracao/estilos" role="search" className="modelos-busca">
        <label htmlFor="modelos-busca">Buscar modelo pelo nome</label>
        <div className="modelos-busca-linha">
          <input
            id="modelos-busca"
            name="busca"
            type="search"
            defaultValue={busca}
            maxLength={60}
            autoComplete="off"
          />
          {filtro !== "todos" ? <input type="hidden" name="estado" value={filtro} /> : null}
          <button type="submit" className="botao botao-secundario">
            Buscar
          </button>
        </div>
      </form>

      <nav aria-label="Filtrar modelos por situação" className="modelos-abas">
        {ABAS.map((a) => (
          <Link
            key={a.filtro}
            href={endereco(a.filtro, busca)}
            aria-current={a.filtro === filtro ? "page" : undefined}
          >
            {a.rotulo}
          </Link>
        ))}
      </nav>
      <p role="status" aria-live="polite" className="modelos-contagem">
        {rotuloContagem(visiveis.length)}
      </p>

      <div className="modelos-corpo">
        <details className="modelos-indice">
          <summary>Ir para um modelo</summary>
          <ol>
            {modelos.map((m) => (
              <li key={m.id}>
                <a href={`#modelo-${m.numero}`}>
                  <span className="modelos-indice-num">{m.numero}</span> {m.nome}
                </a>
              </li>
            ))}
          </ol>
        </details>

        {visiveis.length === 0 ? (
          <p className="ajuda">Nenhum modelo encontrado. Ajuste a busca ou o filtro.</p>
        ) : (
          <ul className="modelos-lista">
            {visiveis.map((m) => (
              <li key={m.id} id={`modelo-${m.numero}`} className="modelo-cartao">
                <header className="modelo-cabeca">
                  <h2>
                    <span className="modelo-num">{m.numero}</span> {m.nome}
                  </h2>
                  <SeloEstado rotulo={m.habilitado ? "Habilitado" : "Desabilitado"} />
                </header>
                {/* eslint-disable-next-line @next/next/no-img-element -- prévia estática pequena, servida de /public */}
                <img
                  className="modelo-previa"
                  src={caminhoPrevia(m.numero)}
                  width={640}
                  height={397}
                  loading="lazy"
                  decoding="async"
                  alt={`Prévia da página inicial do modelo ${m.numero}, ${m.nome}`}
                />
                <div className="modelo-acoes">
                  {m.padrao ? (
                    <p className="ajuda">O modelo padrão não pode ser desabilitado.</p>
                  ) : m.habilitado ? (
                    <AcaoModelo m={m} habilitar={false} />
                  ) : m.pronto ? (
                    <AcaoModelo m={m} habilitar />
                  ) : (
                    <p className="ajuda">O desenho deste modelo ainda não está pronto.</p>
                  )}
                  <a
                    className="modelo-ver"
                    href={caminhoImagemCompleta(m.numero)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ver imagem completa
                    <span className="so-leitor"> do modelo {m.numero} (abre em nova aba)</span>
                  </a>
                </div>
                <p className="modelo-legenda">Modelo {m.numero}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AcaoModelo({ m, habilitar }: { m: ModeloNaTela; habilitar: boolean }) {
  return (
    <details className="modelo-motivo">
      <summary className={habilitar ? "botao botao-secundario" : "botao botao-perigo"}>
        {habilitar ? "Habilitar modelo" : "Desabilitar modelo"}
      </summary>
      <FormHabilitarEstilo estilo={m.id} rotulo={m.nome} habilitar={habilitar} />
    </details>
  );
}
