import { ContaDoMenu } from "./conta-do-menu";
import { MenuPainel } from "./menu-painel";
import type { AtualMenu } from "./menu-painel-dados";
import type { ReactNode } from "react";

/**
 * Moldura das telas autenticadas (D-015): menu lateral em cascata, cabeçalho com sino de avisos (IM-047) e título.
 * O menu mostra só o que a pessoa pode usar; as rotas continuam conferindo a permissão no servidor.
 */
export function PainelPagina({
  titulo,
  subtitulo,
  admin,
  atual,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  /** Dica de que é administrador geral: o grupo Administração já vem na primeira renderização. */
  admin?: boolean;
  /** Seção ativa até o navegador informar o endereço (destaque e grupo aberto). */
  atual?: AtualMenu;
  children: ReactNode;
}) {
  return (
    <MenuPainel atual={atual} admin={admin} identificacao={<ContaDoMenu />}>
      <main className="pagina pagina-painel painel-conteudo">
        <h1>{titulo}</h1>
        {subtitulo ? <p className="subtitulo">{subtitulo}</p> : null}
        {children}
      </main>
    </MenuPainel>
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
