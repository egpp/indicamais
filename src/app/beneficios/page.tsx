import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPublico } from "../_componentes/publico";
import { AVISO_SEM_RESGATE, ListaBeneficiosPublicos } from "../_componentes/pontos";
import { Aviso } from "../_componentes/ui";
import { obterServicoPontosPublico } from "../_lib/contexto-pontos";
import { obterContextoPublico } from "../_lib/contexto-publico";
import { metadadosPublicos } from "../_lib/metadados-publicos";
import { ROTAS_PUBLICAS } from "@/shared/config/rotas-publicas";

/**
 * IM-036, IM-079: vitrine pública e só informativa dos benefícios em pontos. Sem resgate, cupom ou sorteio
 * (IM-037, IM-038). Renderizada no servidor; noindex enquanto PUBLICO_INDEXAVEL estiver desligado (IM-089).
 * Só aparece o que está aprovado, ligado, com perfil publicado e dentro do prazo de resgate.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = metadadosPublicos({
  titulo: "Benefícios | IndicaMais",
  descricao: "Veja os benefícios que empresas do IndicaMais oferecem em troca de pontos.",
  caminho: "/beneficios",
});

export default async function PaginaBeneficiosPublica() {
  const r = await obterServicoPontosPublico().listarBeneficiosPublicos();
  const leitura = obterContextoPublico().leitura;
  const ids = r.ok ? [...new Set(r.valor.map((b) => b.perfilId))] : [];
  const perfis = new Map(
    (
      await Promise.all(
        ids.map(async (id) => {
          try {
            return await leitura.perfilPorId(id);
          } catch {
            return null;
          }
        }),
      )
    )
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .map((p) => [p.id, p] as const),
  );
  // Sem perfil publicado e disponível, o benefício não aparece (IM-079).
  const beneficios = r.ok ? r.valor.filter((b) => perfis.has(b.perfilId)) : [];

  return (
    <main className="pagina pagina-publica">
      <CabecalhoPublico />
      <h1>Benefícios</h1>
      <p className="subtitulo">Benefícios que as empresas oferecem em troca de pontos.</p>
      <Aviso tipo="info">{AVISO_SEM_RESGATE}</Aviso>
      {!r.ok ? (
        <Aviso tipo="erro">{r.erro.mensagem}</Aviso>
      ) : beneficios.length === 0 ? (
        <p className="ajuda">Nenhum benefício disponível no momento.</p>
      ) : (
        <ListaBeneficiosPublicos
          beneficios={beneficios}
          nomeDoPerfil={(id) => {
            const p = perfis.get(id);
            return p ? (
              <Link href={ROTAS_PUBLICAS.perfil(p.slug)}>{p.nome ?? "Ver perfil"}</Link>
            ) : null;
          }}
        />
      )}
      <p className="rodape-links">
        <Link href="/">Voltar para a página inicial</Link>
      </p>
    </main>
  );
}
