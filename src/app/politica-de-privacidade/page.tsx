import type { Metadata } from "next";
import { CartaoPagina } from "../_componentes/ui";
import { SEM_INDEXACAO } from "../_lib/pagina";

export const metadata: Metadata = {
  title: "Política de privacidade (provisória) | IndicaMais",
  ...SEM_INDEXACAO,
};

/**
 * Texto PROVISÓRIO (pendência registrada em docs/decisoes.md): a política definitiva depende de revisão do
 * Emerson (e, se ele quiser, de orientação jurídica). Cobre só o pedido de contato do visitante.
 */
export default function PaginaPolitica() {
  return (
    <CartaoPagina titulo="Política de privacidade">
      <p>
        <span className="rotulo-provisorio">Texto provisório</span>
      </p>
      <p>
        Este texto é provisório e será substituído pela política definitiva do IndicaMais antes do
        lançamento.
      </p>
      <h2>Pedido de contato</h2>
      <p>
        Ao pedir contato, você informa nome, WhatsApp e, se quiser, e-mail e mensagem. Esses dados
        são enviados somente ao responsável pelo perfil ou anúncio escolhido, para que ele responda
        ao seu pedido. A administração do IndicaMais pode consultá-los para suporte e segurança.
      </p>
      <p>
        Quem indicou o perfil ou anúncio não recebe seus dados: vê apenas que a indicação resultou
        em um pedido de contato. Você não precisa criar conta para pedir contato.
      </p>
      <p>
        Para pedir a remoção dos seus dados, fale com o responsável ou com o IndicaMais. O canal de
        atendimento será informado na versão definitiva.
      </p>
    </CartaoPagina>
  );
}
