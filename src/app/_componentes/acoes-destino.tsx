import { novaChaveContato } from "@/modules/indicacoes";
import { FormContato } from "./form-contato";
import { IndicarDestino } from "./indicar-destino";

/**
 * Ações da página pública de perfil ou item (IM-013): "Quero entrar em contato" e "Indique ...". O "Curtir" fica em CurtirPerfil (só logado, IM-043). Renderizado no servidor: a chave de idempotência do contato nasce aqui, uma vez por
 * formulário renderizado, e o código `ind` da URL vai só para o formulário DESTE destino (IM-025). Nada do
 * responsável (WhatsApp, e-mail, conta) entra no HTML: o endereço do WhatsApp só sai depois do envio.
 */
const CODIGO_IND = /^[0-9a-f]{32}$/;

export function AcoesDoDestino({
  tipo,
  id,
  slug,
  rotuloIndicar,
  retorno,
  ind,
}: {
  tipo: "perfil" | "item";
  id?: string;
  slug?: string;
  rotuloIndicar: string;
  /** Caminho da própria página, sem parâmetros: para onde voltar depois de entrar. */
  retorno: string;
  /** Valor bruto de ?ind= da URL desta página. */
  ind?: string;
}) {
  return (
    <>
      <div className="acoes-pagina">
        <a className="botao" href="#contato">
          Quero entrar em contato
        </a>
        <IndicarDestino tipo={tipo} id={id} slug={slug} rotulo={rotuloIndicar} retorno={retorno} />
      </div>
      <section id="contato" className="secao-contato" aria-labelledby="titulo-contato">
        <h2 id="titulo-contato">Pedido de contato</h2>
        <p className="ajuda">
          Sem cadastro. Informe seu nome e WhatsApp para o responsável responder.
        </p>
        <FormContato
          tipo={tipo}
          id={id}
          slug={slug}
          chave={novaChaveContato()}
          ind={ind && CODIGO_IND.test(ind) ? ind : undefined}
        />
      </section>
    </>
  );
}
