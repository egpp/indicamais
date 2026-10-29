import type { ReactNode } from "react";
import type { ContatoAdmin, PedidoContato } from "@/modules/indicacoes";
import { formatarE164BR } from "@/shared/formatacao/telefone";
import { formatarDataHora } from "../_lib/apresentacao";
import { SeloEstado } from "./painel";

/**
 * Cartão de pedido de contato (IM-027): dados do visitante para o RESPONSÁVEL do destino e para a
 * administração. Nunca usado na tela do indicador (IM-029).
 */

export const LEGENDA_EMAIL_NAO_CONFIGURADO =
  "Aviso por e-mail ainda não configurado: veja aqui no painel";

export function legendaNotificacao(estado: string, emailConfigurado: boolean): string {
  switch (estado) {
    case "enviada":
      return "Aviso por e-mail enviado";
    case "falhou":
      return "O aviso por e-mail falhou";
    default:
      return emailConfigurado ? "Aviso por e-mail pendente" : LEGENDA_EMAIL_NAO_CONFIGURADO;
  }
}

/** wa.me só para número brasileiro normalizado (+55). */
export function urlWhatsappDoPedido(e164: string): string | null {
  return /^\+55[0-9]{10,11}$/.test(e164) ? `https://wa.me/${e164.slice(1)}` : null;
}

export function CartaoPedido({
  pedido,
  emailConfigurado,
  administracao,
  children,
}: {
  pedido: PedidoContato | ContatoAdmin;
  emailConfigurado: boolean;
  /** Dados extras da administração (suspeita, tentativas, alerta). */
  administracao?: ContatoAdmin;
  children?: ReactNode;
}) {
  const wa = urlWhatsappDoPedido(pedido.visitanteWhatsapp);
  return (
    <li className="cartao">
      <h2>{pedido.visitanteNome}</h2>
      <p>
        <SeloEstado rotulo={pedido.destinoTipo === "perfil" ? "Perfil" : "Produto ou serviço"} />{" "}
        {pedido.destinoNome}
      </p>
      <dl className="lista-dados">
        <dt>WhatsApp</dt>
        <dd>
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer">
              {formatarE164BR(pedido.visitanteWhatsapp)}
            </a>
          ) : (
            formatarE164BR(pedido.visitanteWhatsapp)
          )}
        </dd>
        {pedido.visitanteEmail ? (
          <>
            <dt>E-mail</dt>
            <dd>
              <a href={`mailto:${pedido.visitanteEmail}`}>{pedido.visitanteEmail}</a>
            </dd>
          </>
        ) : null}
        {pedido.mensagem ? (
          <>
            <dt>Mensagem</dt>
            <dd className="texto-corrido">{pedido.mensagem}</dd>
          </>
        ) : null}
        <dt>Recebido em</dt>
        <dd>{formatarDataHora(pedido.criadoEm)}</dd>
        <dt>Origem</dt>
        <dd>{pedido.veioPorIndicacao ? "Veio por indicação" : "Contato direto"}</dd>
        <dt>Aviso por e-mail</dt>
        <dd>{legendaNotificacao(pedido.notificacaoEstado, emailConfigurado)}</dd>
      </dl>
      {administracao ? (
        <dl className="lista-dados">
          <dt>Autoindicação</dt>
          <dd>
            {administracao.autoindicacaoSuspeita ? "Suspeita de autoindicação" : "Sem suspeita"}
          </dd>
          <dt>Tentativas de aviso</dt>
          <dd>
            {administracao.tentativas}
            {administracao.ultimaTentativaEm
              ? `, a última em ${formatarDataHora(administracao.ultimaTentativaEm)}`
              : ""}
          </dd>
          {administracao.ultimoErro ? (
            <>
              <dt>Último erro</dt>
              <dd>{administracao.ultimoErro}</dd>
            </>
          ) : null}
          {administracao.reenvioSolicitadoEm ? (
            <>
              <dt>Reenvio pedido em</dt>
              <dd>{formatarDataHora(administracao.reenvioSolicitadoEm)}</dd>
            </>
          ) : null}
          <dt>Alerta</dt>
          <dd>
            {administracao.alertaEstado === "aberto"
              ? "Alerta aberto"
              : administracao.alertaEstado === "tratado"
                ? "Alerta tratado"
                : "Sem alerta"}
          </dd>
        </dl>
      ) : null}
      {children}
    </li>
  );
}
