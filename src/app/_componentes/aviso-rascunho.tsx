import type { ReactNode } from "react";
import { Aviso } from "./ui";

/** Aviso no topo do detalhe: há alterações salvas que ainda não foram enviadas para aprovação. */
export function AvisoRascunhoNaoEnviado({ children }: { children?: ReactNode }) {
  return (
    <Aviso tipo="info">
      <p>
        <strong>Você tem alterações salvas que ainda não foram enviadas para aprovação.</strong>
      </p>
      {children}
    </Aviso>
  );
}

/** Etiqueta das listas para rascunho pendente de envio. */
export function EtiquetaRascunhoNaoEnviado() {
  return <span className="selo">Rascunho não enviado</span>;
}
