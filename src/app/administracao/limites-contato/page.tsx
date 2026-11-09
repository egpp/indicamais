import type { Metadata } from "next";
import Link from "next/link";
import { TIPOS_ALARME_CONTATO, type AlarmeContato } from "@/modules/indicacoes";
import { FormLimiteContato, FormRecusaExcesso } from "../../_componentes/form-limites-contato";
import { PainelPagina } from "../../_componentes/painel";
import { Aviso } from "../../_componentes/ui";
import { formatarDataHora } from "../../_lib/apresentacao";
import { exigirAdministrador, obterContextoIndicacoes } from "../../_lib/contexto-indicacoes";
import { SEM_INDEXACAO, um } from "../../_lib/pagina";

export const metadata: Metadata = { title: "Limites do contato | IndicaMais", ...SEM_INDEXACAO };
export const dynamic = "force-dynamic";

const ROTA = "/administracao/limites-contato";
const ROTULO_TIPO: Record<AlarmeContato["tipo"], string> = {
  link: "Por link",
  destino: "Por destino",
  global: "Global",
};
const ROTULO_NIVEL = ["1 vez o limite", "2 vezes o limite", "4 vezes o limite"];
const LIMITES_TELA = [
  { chave: "contato_limite_por_link_hora", titulo: "Pedidos por link, por hora" },
  { chave: "contato_limite_por_destino_hora", titulo: "Pedidos por destino, por hora" },
  { chave: "contato_limite_global_hora", titulo: "Pedidos no total, por hora" },
];

function href(tipo: string | undefined, pagina: number): string {
  const q = new URLSearchParams();
  if (tipo) q.set("tipo", tipo);
  if (pagina > 1) q.set("pagina", String(pagina));
  const s = q.toString();
  return `${ROTA}${s ? `?${s}` : ""}`;
}

/** O alvo é um identificador interno, não dado pessoal; aparece abreviado. */
function abreviar(id: string | null): string {
  return id ? id.slice(0, 8) : "todos";
}

/**
 * Limites do contato (D-034 item 1; IM-076, IM-086): interruptor da recusa de excesso, limites por hora e alarmes
 * de excesso. Cada alteração exige motivo e fica na auditoria. Sem dado pessoal. Quem não é administrador recebe 404.
 */
export default async function PaginaLimitesContato({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await obterContextoIndicacoes(ROTA);
  await exigirAdministrador(ctx);
  const sp = await searchParams;
  const tipo = TIPOS_ALARME_CONTATO.find((t) => t === um(sp.tipo));
  const pagina = Math.max(1, Number.parseInt(um(sp.pagina) ?? "1", 10) || 1);
  const [parametros, alarmes] = await Promise.all([
    ctx.servico.listarParametrosContato(),
    ctx.servico.listarAlarmesContato({ ...(tipo ? { tipo } : {}), pagina }),
  ]);
  const recusa = parametros.ok
    ? parametros.valor.find((p) => p.chave === "contato_recusar_excesso")
    : undefined;
  const ultima = alarmes.ok
    ? Math.max(1, Math.ceil(alarmes.valor.total / alarmes.valor.porPagina))
    : 1;

  return (
    <PainelPagina
      titulo="Limites do contato"
      subtitulo="Controle de excesso de pedidos de contato por hora."
      admin
      atual="administracao"
    >
      <section aria-labelledby="titulo-recusa">
        <h2 id="titulo-recusa">Recusa de excesso</h2>
        {!parametros.ok ? (
          <Aviso tipo="erro">{parametros.erro.mensagem}</Aviso>
        ) : !recusa ? (
          <Aviso tipo="info">Parâmetro indisponível.</Aviso>
        ) : (
          <div className="cartao">
            <p>
              Situação atual: <strong>{recusa.valor === 1 ? "Ligada" : "Desligada"}</strong>
            </p>
            <p className="ajuda">{recusa.descricao}</p>
            <Aviso tipo="atencao">
              Só ligue com o Turnstile no ar. Ligada, os pedidos acima dos limites são recusados com
              a mensagem &quot;Muitos pedidos em pouco tempo&quot; e o alarme dessa tentativa não é
              gravado.
            </Aviso>
            <FormRecusaExcesso ligada={recusa.valor === 1} />
            <p className="ajuda">Atualizado em {formatarDataHora(recusa.atualizadoEm)}.</p>
          </div>
        )}
      </section>

      <section aria-labelledby="titulo-limites">
        <h2 id="titulo-limites">Limites por hora</h2>
        {!parametros.ok ? null : (
          <ul className="lista-cartoes">
            {LIMITES_TELA.map(({ chave, titulo }) => {
              const p = parametros.valor.find((x) => x.chave === chave);
              if (!p) return null;
              return (
                <li key={chave} className="cartao">
                  <h3>{titulo}</h3>
                  <p>{p.descricao}</p>
                  <dl className="lista-dados">
                    <dt>Valor atual</dt>
                    <dd>{p.valor}</dd>
                    <dt>Faixa permitida</dt>
                    <dd>
                      de {p.minimo} a {p.maximo}
                    </dd>
                    <dt>Atualizado em</dt>
                    <dd>{formatarDataHora(p.atualizadoEm)}</dd>
                  </dl>
                  <details>
                    <summary className="botao-texto">Alterar</summary>
                    <FormLimiteContato
                      chave={p.chave}
                      valor={p.valor}
                      minimo={p.minimo}
                      maximo={p.maximo}
                    />
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-alarmes">
        <h2 id="titulo-alarmes">Alarmes de excesso</h2>
        <p className="ajuda">
          Um alarme aparece quando os pedidos chegam a 1, 2 ou 4 vezes o limite numa hora. Não há
          dados pessoais aqui.
        </p>
        <nav aria-label="Filtrar alarmes por tipo" className="abas-admin">
          <Link href={href(undefined, 1)} aria-current={tipo ? undefined : "page"}>
            Todos
          </Link>
          {TIPOS_ALARME_CONTATO.map((t) => (
            <Link key={t} href={href(t, 1)} aria-current={tipo === t ? "page" : undefined}>
              {ROTULO_TIPO[t]}
            </Link>
          ))}
        </nav>
        {!alarmes.ok ? (
          <Aviso tipo="erro">{alarmes.erro.mensagem}</Aviso>
        ) : alarmes.valor.itens.length === 0 ? (
          <Aviso tipo="info">
            Nenhum alarme de excesso registrado. Está tudo dentro dos limites.
          </Aviso>
        ) : (
          <>
            <ul className="lista-cartoes">
              {alarmes.valor.itens.map((a) => (
                <li key={a.id} className="cartao">
                  <h3>{ROTULO_TIPO[a.tipo]}</h3>
                  <dl className="lista-dados">
                    <dt>Alvo</dt>
                    <dd>{abreviar(a.alvoId)}</dd>
                    <dt>Nível</dt>
                    <dd>{ROTULO_NIVEL[a.nivel] ?? `Nível ${a.nivel}`}</dd>
                    <dt>Pedidos na hora</dt>
                    <dd>
                      {a.quantidade} (limite {a.limite})
                    </dd>
                    <dt>Hora do alarme</dt>
                    <dd>{formatarDataHora(a.janela)}</dd>
                    <dt>Registrado em</dt>
                    <dd>{formatarDataHora(a.criadoEm)}</dd>
                  </dl>
                </li>
              ))}
            </ul>
            <nav className="paginacao" aria-label="Paginação">
              {alarmes.valor.pagina > 1 ? (
                <Link
                  className="botao botao-secundario"
                  rel="prev"
                  href={href(tipo, alarmes.valor.pagina - 1)}
                >
                  Página anterior
                </Link>
              ) : (
                <span />
              )}
              <span className="pagina-atual">
                Página {alarmes.valor.pagina} de {ultima}
              </span>
              {alarmes.valor.pagina < ultima ? (
                <Link
                  className="botao botao-secundario"
                  rel="next"
                  href={href(tipo, alarmes.valor.pagina + 1)}
                >
                  Próxima página
                </Link>
              ) : (
                <span />
              )}
            </nav>
          </>
        )}
      </section>
    </PainelPagina>
  );
}
