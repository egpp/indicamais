import { LogoMarca } from "./marca";
import type { ReactNode } from "react";

/** Aviso de erro (role=alert), sucesso/informação (role=status). */
export function Aviso({
  tipo,
  children,
}: {
  tipo: "erro" | "sucesso" | "info" | "atencao";
  children: ReactNode;
}) {
  return (
    <div className={`aviso aviso-${tipo}`} role={tipo === "erro" ? "alert" : "status"}>
      {children}
    </div>
  );
}

/** Botão de envio travado enquanto envia, para não duplicar (IM-028). */
export function BotaoEnviar({
  enviando,
  rotulo,
  rotuloEnviando = "Enviando...",
  secundario,
  perigo,
}: {
  enviando: boolean;
  rotulo: string;
  rotuloEnviando?: string;
  secundario?: boolean;
  /** Ação destrutiva ou de rejeição: vermelho. */
  perigo?: boolean;
}) {
  return (
    <button
      type="submit"
      className={perigo ? "botao botao-perigo" : secundario ? "botao botao-secundario" : "botao"}
      disabled={enviando}
      aria-disabled={enviando}
    >
      {enviando ? rotuloEnviando : rotulo}
    </button>
  );
}

export function CartaoPagina({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
}) {
  return (
    <main className="pagina">
      <LogoMarca />
      <div className="superficie">
        <h1>{titulo}</h1>
        {subtitulo ? <p className="subtitulo">{subtitulo}</p> : null}
        {children}
      </div>
    </main>
  );
}
