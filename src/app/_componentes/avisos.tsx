import Link from "next/link";

/** Abas da área de avisos (IM-047 a IM-049). São links entre páginas, então funcionam sem JavaScript. */
export function AbasAvisos({ atual }: { atual: "avisos" | "quem" | "minhas" }) {
  const abas = [
    { chave: "avisos", href: "/avisos", texto: "Avisos" },
    { chave: "quem", href: "/avisos/quem-me-indicou", texto: "Quem me indicou" },
    { chave: "minhas", href: "/minhas-indicacoes", texto: "Minhas indicações" },
  ] as const;
  return (
    <nav aria-label="Seções de avisos">
      <ul className="abas">
        {abas.map((a) => (
          <li key={a.chave}>
            <Link href={a.href} aria-current={a.chave === atual ? "page" : undefined}>
              {a.texto}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
