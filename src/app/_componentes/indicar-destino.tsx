"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { acaoGerarLink, acaoRegistrarCompartilhamento } from "../acoes-indicacoes";
import { ESTADO_INICIAL } from "../_lib/estado-formulario";
import type { EstadoLink, LinkParaCompartilhar } from "../_lib/estado-indicacoes";
import { Aviso, BotaoEnviar } from "./ui";

/**
 * "Indique esta empresa / este produto ou serviço" (IM-024). Gera o link no servidor (exige conta com WhatsApp
 * cadastrado) e oferece copiar e compartilhar no WhatsApp. Sem conta, leva a entrar e volta para a página.
 */
export function IndicarDestino({
  tipo,
  id,
  slug,
  rotulo,
  retorno,
  secundario = true,
}: {
  tipo: "perfil" | "item";
  id?: string;
  slug?: string;
  rotulo: string;
  /** Caminho da página de origem (sem parâmetros) para voltar depois de entrar. */
  retorno: string;
  secundario?: boolean;
}) {
  const [estado, action, enviando] = useActionState<EstadoLink, FormData>(
    acaoGerarLink,
    ESTADO_INICIAL,
  );
  return (
    <div className="indicar">
      <form action={action}>
        <input type="hidden" name="tipo" value={tipo} />
        {id ? <input type="hidden" name="id" value={id} /> : null}
        {slug ? <input type="hidden" name="slug" value={slug} /> : null}
        <BotaoEnviar
          enviando={enviando}
          rotulo={rotulo}
          rotuloEnviando="Gerando seu link..."
          secundario={secundario}
        />
      </form>
      {estado.erro ? (
        <Aviso tipo={estado.passo === "autoindicacao" ? "info" : "erro"}>{estado.erro}</Aviso>
      ) : null}
      {estado.passo === "entrar" ? (
        <p className="acoes-linha">
          <Link className="botao" href={`/entrar?proximo=${encodeURIComponent(retorno)}`}>
            Entrar
          </Link>
          <Link className="botao botao-secundario" href="/cadastro">
            Criar conta
          </Link>
        </p>
      ) : null}
      {estado.passo === "whatsapp" ? (
        <p>
          <Link className="botao" href="/minha-conta">
            Cadastrar meu WhatsApp
          </Link>
        </p>
      ) : null}
      {estado.link ? <LinkGerado link={estado.link} /> : null}
    </div>
  );
}

/** Link pronto: campo para ver, copiar e compartilhar no WhatsApp. */
export function LinkGerado({ link }: { link: LinkParaCompartilhar }) {
  const campo = useRef<HTMLInputElement>(null);
  const [copiado, setCopiado] = useState<"sim" | "manual" | null>(null);

  function registrar(canal: "copiar" | "whatsapp") {
    // Informativo: se falhar, o usuário não percebe nem é atrapalhado.
    void acaoRegistrarCompartilhamento(link.codigo, canal).catch(() => undefined);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiado("sim");
    } catch {
      campo.current?.setSelectionRange(0, link.url.length);
      setCopiado("manual");
    }
    registrar("copiar");
  }

  return (
    <div className="link-gerado">
      <div className="campo">
        <label htmlFor={`link-${link.codigo}`}>Seu link de indicação</label>
        <input
          id={`link-${link.codigo}`}
          ref={campo}
          type="text"
          readOnly
          value={link.url}
          onFocus={(e) => e.currentTarget.setSelectionRange(0, e.currentTarget.value.length)}
        />
      </div>
      <p className="acoes-linha">
        <button type="button" className="botao" onClick={copiar}>
          Copiar link
        </button>
        <a
          className="botao botao-secundario"
          href={link.urlWhatsapp}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => registrar("whatsapp")}
        >
          Compartilhar no WhatsApp
        </a>
      </p>
      <div role="status">
        {copiado === "sim" ? <p className="ajuda">Link copiado.</p> : null}
        {copiado === "manual" ? (
          <p className="ajuda">Não foi possível copiar sozinho. Selecione o link acima e copie.</p>
        ) : null}
      </div>
    </div>
  );
}
