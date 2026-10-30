import Link from "next/link";
import { LogoMarca } from "./marca";
import { SinoAvisos } from "./sino-avisos";
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
  atual?:
    | "perfis"
    | "itens"
    | "anuncios"
    | "pedidos"
    | "indicacoes"
    | "pontos"
    | "avisos"
    | "participacoes"
    | "revisoes"
    | "conta"
    | "administracao";
  children: ReactNode;
}) {
  const links: { chave: NonNullable<typeof atual>; href: string; texto: string }[] = [
    { chave: "perfis", href: "/meus-perfis", texto: "Meus perfis" },
    { chave: "itens", href: "/meus-itens", texto: "Meus itens" },
    { chave: "anuncios", href: "/meus-anuncios", texto: "Meus anúncios" },
    { chave: "pedidos", href: "/pedidos-de-contato", texto: "Pedidos de contato" },
    { chave: "indicacoes", href: "/minhas-indicacoes", texto: "Minhas indicações" },
    { chave: "pontos", href: "/pontos", texto: "Meus pontos" },
    { chave: "avisos", href: "/avisos", texto: "Avisos" },
    { chave: "participacoes", href: "/minhas-participacoes", texto: "Minhas participações" },
    { chave: "revisoes", href: "/minhas-revisoes", texto: "Revisões" },
    { chave: "conta", href: "/minha-conta", texto: "Minha conta" },
  ];
  if (admin) {
    links.push({ chave: "administracao", href: "/administracao/revisao", texto: "Administração" });
  }
  return (
    <main className="pagina pagina-painel">
      <div className="topo-painel">
        <LogoMarca />
        <SinoAvisos />
      </div>
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
  return <span className={`selo ${tomDoRotulo(rotulo)}`.trim()}>{rotulo}</span>;
}

/** Só apresentação: escolhe a cor da etiqueta pelo texto. O significado continua no texto. */
function tomDoRotulo(rotulo: string): string {
  const r = rotulo.toLowerCase();
  if (/(rejeitad|inativ|indispon|despublic|suspens|negad|revertid|cancelad)/.test(r))
    return "selo-erro";
  if (/(aguardando|em an[aá]lise|pendente)/.test(r)) return "selo-aviso";
  if (/(publicad|aprovad|ativ[ao]|dispon[ií]vel|conclu[ií]d|confirmad|v[aá]lid)/.test(r))
    return "selo-sucesso";
  return "";
}
