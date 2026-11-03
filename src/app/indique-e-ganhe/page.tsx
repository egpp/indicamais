import type { Metadata } from "next";
import Link from "next/link";
import { IconeHome } from "../_componentes/icones-home";
import { PaginaInstitucional } from "../_componentes/pagina-institucional";
import { metadadosPublicos } from "../_lib/metadados-publicos";

/**
 * Explica as regras vigentes dos pontos (IM-024, IM-025, IM-030 a IM-035, D-012). Valores iniciais da D-012;
 * ficam configuráveis, por isso o texto diz que podem mudar.
 */
export const metadata: Metadata = metadadosPublicos({
  titulo: "Indique e Ganhe | IndicaMais",
  descricao: "Indique empresas, produtos e serviços pelo seu link e acumule pontos.",
  caminho: "/indique-e-ganhe",
});

const PASSOS = [
  {
    icone: "usuario",
    titulo: "Crie sua conta",
    texto: "É por ela que o IndicaMais sabe quem indicou.",
  },
  {
    icone: "enviar",
    titulo: "Gere seu link",
    texto:
      "Na página de uma empresa, produto, serviço ou anúncio, use o botão “Indique” para copiar ou compartilhar o seu link.",
  },
  {
    icone: "conversa",
    titulo: "A pessoa pede contato",
    texto:
      "Quando alguém pede contato pelo seu link, a indicação é registrada. Só visitar ou compartilhar não conta.",
  },
  {
    icone: "presente",
    titulo: "Seus pontos aumentam",
    texto: "Cada indicação válida soma pontos ao seu saldo, que não expira.",
  },
] as const;

export default async function PaginaIndiqueEGanhe() {
  return (
    <PaginaInstitucional
      atual="indique"
      titulo="Indique e Ganhe"
      subtitulo="Indique empresas, produtos e serviços e acumule pontos a cada indicação válida."
    >
      <ol className="passos">
        {PASSOS.map((p, i) => (
          <li key={p.titulo}>
            <span className="passo-icone">
              <IconeHome nome={p.icone} tamanho={28} />
            </span>
            <div>
              <h2>
                {i + 1}. {p.titulo}
              </h2>
              <p>{p.texto}</p>
            </div>
          </li>
        ))}
      </ol>
      <h2>Regras que valem hoje</h2>
      <ul className="lista-regras">
        <li>10 pontos por indicação válida. O valor pode mudar no futuro.</li>
        <li>
          A mesma pessoa, no mesmo destino, só pontua de novo depois de 30 dias da última indicação
          que pontuou. Esse prazo também pode mudar.
        </li>
        <li>Indicar a si mesmo, ou a própria empresa ou anúncio, não gera pontos.</li>
        <li>
          Você não vê o nome completo nem o WhatsApp de quem pediu contato: a privacidade dessa
          pessoa é protegida.
        </li>
        <li>Curtir uma página não gera pontos.</li>
      </ul>
      <p className="institucional-acoes">
        <Link className="botao" href="/cadastro">
          Criar conta
        </Link>
        <Link className="botao botao-secundario" href="/entrar">
          Já tenho conta
        </Link>
      </p>
    </PaginaInstitucional>
  );
}
