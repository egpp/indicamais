import Link from "next/link";
import type { ReactNode } from "react";

/** Moldura das telas autenticadas: marca, navegação por teclado e título. */
export function PainelPagina({
  titulo,
  subtitulo,
  admin,
  atual,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  /** Mostra o atalho da administração (só para quem é administrador). */
  admin?: boolean;
  /** Seção ativa, para aria-current. */
  atual?: "perfis" | "itens" | "anuncios" | "revisoes" | "conta" | "administracao";
  children: ReactNode;
}) {
  const links: { chave: NonNullable<typeof atual>; href: string; texto: string }[] = [
    { chave: "perfis", href: "/meus-perfis", texto: "Meus perfis" },
    { chave: "itens", href: "/meus-itens", texto: "Meus itens" },
    { chave: "anuncios", href: "/meus-anuncios", texto: "Meus anúncios" },
    { chave: "revisoes", href: "/minhas-revisoes", texto: "Revisões" },
    { chave: "conta", href: "/minha-conta", texto: "Minha conta" },
  ];
  if (admin) {
    links.push({ chave: "administracao", href: "/administracao/revisao", texto: "Administração" });
  }
  return (
    <main className="pagina pagina-painel">
      <p className="marca">
        <Link href="/">IndicaMais</Link>
      </p>
      <nav aria-label="Principal">
        <ul className="nav-painel">
          {links.map((l) => (
            <li key={l.chave}>
              <Link href={l.href} aria-current={l.chave === atual ? "page" : undefined}>
                {l.texto}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <h1>{titulo}</h1>
      {subtitulo ? <p className="subtitulo">{subtitulo}</p> : null}
      {children}
    </main>
  );
}

/** Situação do conteúdo (Rascunho, Aguardando aprovação, Publicado...). Texto, não só cor. */
export function SeloEstado({ rotulo }: { rotulo: string }) {
  return <span className="selo">{rotulo}</span>;
}
