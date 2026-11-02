/** Atalho para a página pública de um perfil. Sem página no ar, mostra o estado em vez de um link quebrado. */
export function hrefPerfilPublico(slug: string): string {
  return `/perfil/${encodeURIComponent(slug)}`;
}

function IconeExterno() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 3h7v7" />
      <path d="M10 14 21 3" />
      <path d="M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
    </svg>
  );
}

/**
 * `href` só deve vir preenchido quando o perfil está no ar (publicado e visível ao público).
 * Abre em nova aba para o responsável não perder o painel.
 */
export function LinkPaginaPublica({ nome, href }: { nome: string; href: string | null }) {
  if (!href) {
    return (
      <span
        className="link-pagina-publica link-pagina-publica-desativado"
        role="note"
        aria-label={`Página pública de ${nome}: ainda não publicada`}
        title="Ainda não publicado"
      >
        <IconeExterno />
        <span>Ainda não publicado</span>
      </span>
    );
  }
  return (
    <a
      className="link-pagina-publica"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Ver página pública de ${nome} (abre em nova aba)`}
    >
      <IconeExterno />
      <span>Ver página pública</span>
    </a>
  );
}
