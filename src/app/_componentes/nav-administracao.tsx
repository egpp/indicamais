import Link from "next/link";
import type { Permissao } from "@/modules/administracao";

/**
 * Atalhos da administração da Fase 6. Só aparecem os que a pessoa pode usar (permissões conferidas no servidor);
 * as rotas continuam devolvendo 404 a quem não tem permissão.
 */
export function NavAdministracao({
  permissoes,
  geral,
  atual,
}: {
  permissoes: readonly Permissao[];
  geral: boolean;
  atual?: "denuncias" | "contas" | "indicacoes" | "permissoes";
}) {
  const itens = [
    permissoes.includes("analisar_denuncias") && {
      chave: "denuncias",
      href: "/administracao/denuncias",
      texto: "Denúncias",
    },
    permissoes.includes("suspender") && {
      chave: "contas",
      href: "/administracao/contas",
      texto: "Contas",
    },
    permissoes.includes("invalidar_indicacoes") && {
      chave: "indicacoes",
      href: "/administracao/indicacoes",
      texto: "Invalidar indicações",
    },
    geral && {
      chave: "permissoes",
      href: "/administracao/permissoes",
      texto: "Permissões",
    },
  ].filter((i): i is { chave: string; href: string; texto: string } => Boolean(i));
  if (itens.length === 0) return null;
  return (
    <nav aria-label="Administração">
      <ul className="nav-painel">
        {geral ? (
          <li>
            <Link href="/administracao/revisao">Fila de revisão</Link>
          </li>
        ) : null}
        {itens.map((i) => (
          <li key={i.chave}>
            <Link href={i.href} aria-current={i.chave === atual ? "page" : undefined}>
              {i.texto}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
