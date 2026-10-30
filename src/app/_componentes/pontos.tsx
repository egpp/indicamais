import type { ReactNode } from "react";
import type { BeneficioPublico, SituacaoVersao, VersaoBeneficio } from "@/modules/pontos";
import { formatarDataCivil, formatarPontos } from "../_lib/apresentacao";

/** Dados de benefício reaproveitados nas telas (somente exibição). */

export const ROTULO_SITUACAO_VERSAO: Record<SituacaoVersao, string> = {
  rascunho: "Rascunho",
  pendente: "Em análise",
  aguardando_aceite: "Aguardando aceite do responsável",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
  substituida: "Substituída",
};

type Dados = Pick<
  BeneficioPublico | VersaoBeneficio,
  | "pontosNecessarios"
  | "condicoes"
  | "limiteTotal"
  | "limitePorPessoa"
  | "prazoResgateAte"
  | "prazoUsoDias"
>;

export function DadosBeneficio({ b }: { b: Dados }) {
  return (
    <dl className="lista-dados">
      {b.pontosNecessarios !== null ? (
        <>
          <dt>Pontos necessários</dt>
          <dd>{formatarPontos(b.pontosNecessarios)}</dd>
        </>
      ) : null}
      {b.condicoes ? (
        <>
          <dt>Condições</dt>
          <dd>{b.condicoes}</dd>
        </>
      ) : null}
      {b.limiteTotal !== null ? (
        <>
          <dt>Limite total</dt>
          <dd>{b.limiteTotal}</dd>
        </>
      ) : null}
      {b.limitePorPessoa !== null ? (
        <>
          <dt>Limite por pessoa</dt>
          <dd>{b.limitePorPessoa}</dd>
        </>
      ) : null}
      {b.prazoResgateAte ? (
        <>
          <dt>Resgate possível até</dt>
          <dd>{formatarDataCivil(b.prazoResgateAte)}</dd>
        </>
      ) : null}
      {b.prazoUsoDias !== null ? (
        <>
          <dt>Prazo de uso</dt>
          <dd>{b.prazoUsoDias} dias após o resgate</dd>
        </>
      ) : null}
    </dl>
  );
}

/** Vitrine pública: só informativa. Sem botão de resgate, cupom ou sorteio (IM-037, IM-038). */
export function ListaBeneficiosPublicos({
  beneficios,
  nomeDoPerfil,
}: {
  beneficios: readonly BeneficioPublico[];
  /** Cartão com o nome do perfil (página própria); omitido no próprio perfil. */
  nomeDoPerfil?: (perfilId: string) => ReactNode;
}) {
  return (
    <ul className="lista-cartoes">
      {beneficios.map((b) => (
        <li key={b.id} className="cartao">
          <h3>{b.nome}</h3>
          {nomeDoPerfil ? <p className="ajuda">{nomeDoPerfil(b.perfilId)}</p> : null}
          <p className="texto-corrido">{b.descricao}</p>
          <DadosBeneficio b={b} />
        </li>
      ))}
    </ul>
  );
}

export const AVISO_SEM_RESGATE =
  "Os pontos ainda não podem ser trocados por benefícios. Por enquanto eles só acumulam no seu saldo.";
