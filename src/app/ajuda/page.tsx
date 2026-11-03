import type { Metadata } from "next";
import Link from "next/link";
import { PaginaInstitucional } from "../_componentes/pagina-institucional";
import { metadadosPublicos } from "../_lib/metadados-publicos";

/** O cabeçalho lê a sessão: renderiza por pedido, não no build. */
export const dynamic = "force-dynamic";

/** Dúvidas frequentes que o produto já responde hoje. Sem canal de atendimento inventado. */
export const metadata: Metadata = metadadosPublicos({
  titulo: "Ajuda | IndicaMais",
  descricao: "Dúvidas frequentes sobre buscar, pedir contato, indicar e anunciar no IndicaMais.",
  caminho: "/ajuda",
});

const DUVIDAS: ReadonlyArray<{ pergunta: string; resposta: React.ReactNode }> = [
  {
    pergunta: "Preciso de conta para pedir contato?",
    resposta:
      "Não. Para pedir contato você informa seu nome e WhatsApp. A conta é necessária para indicar, anunciar e cadastrar empresa.",
  },
  {
    pergunta: "Quem vê os meus dados quando peço contato?",
    resposta: (
      <>
        Somente o responsável pela página escolhida e administradores autorizados. Quem indicou não
        recebe seus dados. Veja a{" "}
        <Link href="/politica-de-privacidade">política de privacidade</Link>.
      </>
    ),
  },
  {
    pergunta: "Como minha empresa ou meu anúncio aparece no IndicaMais?",
    resposta:
      "Crie sua conta e cadastre. Todo conteúdo novo passa por aprovação antes de ser publicado, e você acompanha o resultado no painel.",
  },
  {
    pergunta: "Posso anunciar sem ter uma empresa?",
    resposta: "Sim. Pessoas podem criar anúncios particulares, que também passam por aprovação.",
  },
  {
    pergunta: "Como funcionam os pontos?",
    resposta: (
      <>
        Cada indicação válida soma pontos ao seu saldo. As regras estão em{" "}
        <Link href="/indique-e-ganhe">Indique e Ganhe</Link>.
      </>
    ),
  },
  {
    pergunta: "Como falo com o IndicaMais?",
    resposta:
      "O canal de atendimento ainda será divulgado aqui. Para assuntos de uma empresa ou anúncio, fale com o responsável pela página.",
  },
];

export default async function PaginaAjuda() {
  return (
    <PaginaInstitucional
      atual="ajuda"
      titulo="Ajuda"
      subtitulo="Respostas rápidas sobre buscar, pedir contato, indicar e anunciar."
    >
      <div className="duvidas">
        {DUVIDAS.map((d) => (
          <details key={d.pergunta}>
            <summary>{d.pergunta}</summary>
            <p>{d.resposta}</p>
          </details>
        ))}
      </div>
    </PaginaInstitucional>
  );
}
