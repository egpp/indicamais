"use client";

import { ROTULOS_CATEGORIA_REVERSAO } from "@/modules/pontos";
import {
  acaoCadastrarBeneficioAdmin,
  acaoCriarBeneficio,
  acaoDefinirParametroPontos,
  acaoEditarPropostaAdmin,
  acaoReprocessarPedido,
  acaoReverterCredito,
  acaoSalvarBeneficio,
} from "../acoes-pontos";
import type { EstadoPontos } from "../_lib/estado-pontos";
import {
  validarBeneficio,
  validarParametroPontos,
  validarReprocessar,
  validarResposta,
  validarReversao,
  validarDecisao,
  type ModoBeneficio,
} from "../_lib/validacao-pontos";
import { Campo } from "./campos";
import { CampoSelect, CampoTextoLongo } from "./campos-conteudo";
import { Aviso, BotaoEnviar } from "./ui";
import { useFormulario } from "./use-formulario";

type Acao = (estado: EstadoPontos, dados: FormData) => Promise<EstadoPontos>;
type Validador = (d: Record<string, string>) => Record<string, string> | null;

function Ocultos({ campos }: { campos: Record<string, string> }) {
  return (
    <>
      {Object.entries(campos).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

function Mensagens({ estado }: { estado: EstadoPontos }) {
  return (
    <>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
    </>
  );
}

/** Formulário com só o motivo (reprocessar, rejeitar, recusar). Sempre auditado no banco. */
function FormSoMotivo({
  acao,
  validar,
  ocultos,
  rotuloCampo,
  rotuloBotao,
  rotuloEnviando,
  secundario,
  perigo,
  ajuda = "Fica registrado na auditoria.",
}: {
  acao: Acao;
  validar: Validador;
  ocultos: Record<string, string>;
  rotuloCampo: string;
  rotuloBotao: string;
  rotuloEnviando: string;
  secundario?: boolean;
  perigo?: boolean;
  ajuda?: string;
}) {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario<EstadoPontos>(
    acao,
    validar,
  );
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      <Mensagens estado={estado} />
      <Ocultos campos={ocultos} />
      <CampoTextoLongo
        nome="motivo"
        rotulo={rotuloCampo}
        linhas={2}
        valorInicial={estado.valores?.motivo}
        erro={erros.motivo}
        ajuda={ajuda}
      />
      <BotaoEnviar
        enviando={enviando}
        rotulo={rotuloBotao}
        rotuloEnviando={rotuloEnviando}
        secundario={secundario}
        perigo={perigo}
      />
    </form>
  );
}

export function FormReprocessar({ pedidoId }: { pedidoId: string }) {
  return (
    <FormSoMotivo
      acao={acaoReprocessarPedido}
      validar={validarReprocessar}
      ocultos={{ pedidoId }}
      rotuloCampo="Motivo do reprocessamento"
      rotuloBotao="Reprocessar pedido"
      rotuloEnviando="Reprocessando..."
      secundario
    />
  );
}

export function FormMotivoDecisao({
  acao,
  versaoId,
  campo,
  valor,
  rotuloCampo,
  rotuloBotao,
}: {
  acao: Acao;
  versaoId: string;
  /** "decisao" (rejeitar) ou "resposta" (recusar). */
  campo: "decisao" | "resposta";
  valor: "rejeitar" | "recusar";
  rotuloCampo: string;
  rotuloBotao: string;
}) {
  return (
    <FormSoMotivo
      acao={acao}
      validar={campo === "decisao" ? validarDecisao : validarResposta}
      ocultos={{ versaoId, [campo]: valor }}
      rotuloCampo={rotuloCampo}
      rotuloBotao={rotuloBotao}
      rotuloEnviando="Enviando..."
      perigo
      ajuda="Obrigatório. O motivo fica registrado."
    />
  );
}

/** IM-030, D-012: parâmetro de pontos com motivo (auditado). A faixa é conferida pelo banco. */
export function FormParametroPontos({ chave, valor }: { chave: string; valor: number }) {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario<EstadoPontos>(
    acaoDefinirParametroPontos,
    validarParametroPontos,
  );
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      <Mensagens estado={estado} />
      <Ocultos campos={{ chave }} />
      <Campo
        nome="valor"
        rotulo="Novo valor (pontos)"
        inputMode="numeric"
        valorInicial={estado.valores?.valor ?? String(valor)}
        erro={erros.valor}
      />
      <CampoTextoLongo
        nome="motivo"
        rotulo="Motivo da alteração"
        linhas={2}
        valorInicial={estado.valores?.motivo}
        erro={erros.motivo}
        ajuda="Fica registrado na auditoria."
      />
      <BotaoEnviar enviando={enviando} rotulo="Salvar pontos" rotuloEnviando="Salvando..." />
    </form>
  );
}

/**
 * IM-078: reversão de crédito com categoria fixa (visível ao indicador) e observação interna (só administração).
 * Se deixar o saldo negativo, o banco avisa e a confirmação explícita aparece.
 */
export function FormReverter({ lancamentoId }: { lancamentoId: string }) {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario<EstadoPontos>(
    acaoReverterCredito,
    validarReversao,
  );
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      <Mensagens estado={estado} />
      <Ocultos campos={{ lancamentoId }} />
      <CampoSelect
        nome="categoria"
        rotulo="Categoria da reversão"
        erro={erros.categoria}
        valorInicial={estado.valores?.categoria}
        ajuda="É o que o indicador vai ver."
        opcoes={Object.entries(ROTULOS_CATEGORIA_REVERSAO).map(([valor, rotulo]) => ({
          valor,
          rotulo,
        }))}
      />
      <CampoTextoLongo
        nome="observacao"
        rotulo="Observação interna"
        linhas={2}
        valorInicial={estado.valores?.observacao}
        erro={erros.observacao}
        ajuda="Só a administração vê. Fica registrada na auditoria."
      />
      {estado.pedirConfirmacao ? (
        <div className="campo-marcar">
          <label>
            <input type="checkbox" name="confirmarSaldoNegativo" value="sim" />
            Confirmo reverter mesmo deixando o saldo deste indicador negativo
          </label>
        </div>
      ) : null}
      <BotaoEnviar
        enviando={enviando}
        rotulo={estado.pedirConfirmacao ? "Confirmar reversão" : "Reverter crédito"}
        rotuloEnviando="Revertendo..."
        perigo
      />
    </form>
  );
}

export type ValoresBeneficio = {
  nome?: string | null;
  descricao?: string | null;
  pontosNecessarios?: number | null;
  condicoes?: string | null;
  limiteTotal?: number | null;
  limitePorPessoa?: number | null;
  prazoResgateAte?: string | null;
  prazoUsoDias?: number | null;
};

const texto = (v: string | number | null | undefined) =>
  v === null || v === undefined ? "" : String(v);

const acaoDoModo = (modo: ModoBeneficio): Acao =>
  modo === "criar"
    ? acaoCriarBeneficio
    : modo === "salvar"
      ? acaoSalvarBeneficio
      : modo === "admin-cadastrar"
        ? acaoCadastrarBeneficioAdmin
        : acaoEditarPropostaAdmin;

/**
 * IM-036: dados de um benefício. Prazo de uso em "N dias após o resgate"; prazo de resgate como data.
 * Não existe resgate, cupom nem sorteio nesta etapa (IM-037, IM-038).
 */
export function FormBeneficio({
  modo,
  ocultos = {},
  inicial = {},
  perfilInicial = "",
  rotuloBotao,
  rotuloEnviando = "Salvando...",
}: {
  modo: ModoBeneficio;
  /** perfilId (criar), beneficioId (salvar) ou versaoId (admin-editar). */
  ocultos?: Record<string, string>;
  inicial?: ValoresBeneficio;
  perfilInicial?: string;
  rotuloBotao: string;
  rotuloEnviando?: string;
}) {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario<EstadoPontos>(
    acaoDoModo(modo),
    (d) => validarBeneficio(modo, d),
  );
  const v = (k: keyof ValoresBeneficio) => estado.valores?.[k] ?? texto(inicial[k]);
  const comMotivo = modo === "admin-cadastrar" || modo === "admin-editar";
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      <Mensagens estado={estado} />
      <Ocultos campos={ocultos} />
      {modo === "admin-cadastrar" ? (
        <Campo
          nome="perfilId"
          rotulo="Identificador do perfil"
          valorInicial={estado.valores?.perfilId ?? perfilInicial}
          erro={erros.perfilId}
          ajuda="O perfil precisa estar publicado."
        />
      ) : null}
      <Campo nome="nome" rotulo="Nome do benefício" valorInicial={v("nome")} erro={erros.nome} />
      <CampoTextoLongo
        nome="descricao"
        rotulo="Descrição"
        valorInicial={v("descricao")}
        erro={erros.descricao}
      />
      <Campo
        nome="pontosNecessarios"
        rotulo="Pontos necessários"
        inputMode="numeric"
        valorInicial={v("pontosNecessarios")}
        erro={erros.pontosNecessarios}
      />
      <CampoTextoLongo
        nome="condicoes"
        rotulo="Condições"
        linhas={3}
        opcional
        valorInicial={v("condicoes")}
        erro={erros.condicoes}
      />
      <Campo
        nome="limiteTotal"
        rotulo="Limite total de benefícios"
        inputMode="numeric"
        opcional
        valorInicial={v("limiteTotal")}
        erro={erros.limiteTotal}
        ajuda="Deixe em branco para não limitar."
      />
      <Campo
        nome="limitePorPessoa"
        rotulo="Limite por pessoa"
        inputMode="numeric"
        opcional
        valorInicial={v("limitePorPessoa")}
        erro={erros.limitePorPessoa}
      />
      <Campo
        nome="prazoResgateAte"
        tipo="date"
        rotulo="Resgate possível até"
        opcional
        valorInicial={v("prazoResgateAte")}
        erro={erros.prazoResgateAte}
        ajuda="Passada essa data, o benefício sai da vitrine."
      />
      <Campo
        nome="prazoUsoDias"
        rotulo="Prazo de uso, em dias após o resgate"
        inputMode="numeric"
        opcional
        valorInicial={v("prazoUsoDias")}
        erro={erros.prazoUsoDias}
        ajuda="Exemplo: 30 dias após o resgate."
      />
      {comMotivo ? (
        <CampoTextoLongo
          nome="motivo"
          rotulo={modo === "admin-editar" ? "Motivo da contraproposta" : "Motivo do cadastro"}
          linhas={2}
          valorInicial={estado.valores?.motivo}
          erro={erros.motivo}
          ajuda="Fica registrado na auditoria."
        />
      ) : null}
      <BotaoEnviar enviando={enviando} rotulo={rotuloBotao} rotuloEnviando={rotuloEnviando} />
    </form>
  );
}
