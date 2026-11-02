/**
 * Ícone-link do cabeçalho do painel para a página inicial pública, como um visitante sem login a vê
 * (IM-005, IM-014, IM-047). Abre em nova aba. Mesma linguagem visual do sino: alvo de 44px, foco visível.
 */
export const ROTULO_VER_COMO_VISITANTE = "Ver o site como visitante (abre em nova aba)";

export function VerComoVisitante() {
  return (
    <a
      className="sino"
      href="/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ROTULO_VER_COMO_VISITANTE}
      title="Ver o site como visitante"
    >
      <svg
        viewBox="0 0 24 24"
        width="24"
        height="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18" />
      </svg>
    </a>
  );
}
