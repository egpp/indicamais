import type { Metadata } from "next";
import Link from "next/link";
import { IconeHome } from "../_componentes/icones-home";
import { PaginaInstitucional } from "../_componentes/pagina-institucional";
import { metadadosPublicos } from "../_lib/metadados-publicos";

/** Explica o que o IndicaMais faz hoje (IM-019, IM-021, IM-024, IM-026, IM-029). Sem prometer o que não existe. */
export const metadata: Metadata = metadadosPublicos({
  titulo: "Como funciona | IndicaMais",
  descricao: "Veja como encontrar empresas, pedir contato e indicar no IndicaMais.",
  caminho: "/como-funciona",
});

const PASSOS = [
  {
    icone: "busca",
    titulo: "Encontre",
    texto:
      "Busque pelo nome ou navegue por categoria, cidade e UF. Só aparecem empresas, profissionais, produtos, serviços e anúncios que foram aprovados e publicados.",
  },
  {
    icone: "conversa",
    titulo: "Peça contato",
    texto:
      "Na página do que você escolheu, use “Quero entrar em contato”. Você informa seu nome e WhatsApp, sem criar conta, e segue para conversar com o responsável.",
  },
  {
    icone: "pessoas",
    titulo: "Indique",
    texto:
      "Quem tem conta gera um link de indicação e compartilha. Quando alguém pede contato por esse link, a indicação conta.",
  },
  {
    icone: "presente",
    titulo: "Ganhe pontos",
    texto: "Cada indicação válida soma pontos ao seu saldo. Saiba as regras em “Indique e Ganhe”.",
  },
] as const;

export default async function PaginaComoFunciona() {
  return (
    <PaginaInstitucional
      atual="como-funciona"
      titulo="Como funciona"
      subtitulo="O IndicaMais aproxima quem precisa de quem oferece, com indicações de pessoas reais."
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
      <h2>Tem uma empresa, é profissional ou quer anunciar?</h2>
      <p>
        Crie sua conta e cadastre sua empresa, seus produtos e serviços, ou um anúncio particular.
        Todo conteúdo novo passa por uma revisão antes de aparecer para o público.
      </p>
      <h2>Sua privacidade</h2>
      <p>
        Quem indica não recebe o seu nome completo nem o seu WhatsApp. Seus dados vão somente ao
        responsável pela página que você escolheu. Leia a{" "}
        <Link href="/politica-de-privacidade">política de privacidade</Link>.
      </p>
      <p className="institucional-acoes">
        <Link className="botao" href="/">
          Buscar agora
        </Link>
        <Link className="botao botao-secundario" href="/indique-e-ganhe">
          Indique e Ganhe
        </Link>
      </p>
    </PaginaInstitucional>
  );
}
