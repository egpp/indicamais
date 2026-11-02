import { classeDeFontes } from "./fontes";
import type { TemaEstilo } from "./estilos";
import "./site.css";

/**
 * Miniatura de um estilo (D-016; IM-091), feita em HTML e CSS com as mesmas variáveis do tema real: sem imagens
 * para baixar e sempre igual ao resultado. Decorativa (aria-hidden): o nome do estilo está no texto ao lado.
 */
export function MiniaturaEstilo({ tema }: { tema: TemaEstilo }) {
  if (!tema.liberado) {
    return (
      <div className="st-mini st-mini-breve" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    );
  }
  return (
    <div className={`site site-${tema.id} st-mini ${classeDeFontes(tema.id)}`} aria-hidden="true">
      <div className="st-mini-menu">
        <b>Seu negócio</b>
        <i />
      </div>
      <div className="st-mini-banner" />
      <div className="st-mini-corpo">
        <b className="st-mini-titulo">Seu negócio</b>
        <span className="st-mini-linha" />
        <span className="st-mini-linha st-mini-linha-curta" />
        <span className="st-mini-botao">Contato</span>
      </div>
    </div>
  );
}
