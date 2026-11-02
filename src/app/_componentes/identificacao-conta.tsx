/**
 * Quem está logada, abaixo do logotipo do menu (IM-005, IM-014). Texto, não botão; trunca com reticências e guarda o
 * texto inteiro no title e no rótulo acessível. Dado da própria pessoa; nunca vai para HTML público.
 */
export function IdentificacaoConta({ nome, email }: { nome?: string | null; email: string }) {
  const nomeLimpo = nome?.trim() || null;
  const rotulo = nomeLimpo ? `Conta: ${nomeLimpo}, ${email}` : `Conta: ${email}`;
  return (
    <div className="menu-conta" role="group" aria-label={rotulo} title={rotulo}>
      {nomeLimpo ? (
        <p className="menu-conta-nome" aria-hidden="true">
          {nomeLimpo}
        </p>
      ) : null}
      <p className={nomeLimpo ? "menu-conta-email" : "menu-conta-nome"} aria-hidden="true">
        {email}
      </p>
    </div>
  );
}
