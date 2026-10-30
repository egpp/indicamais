"use client";

import type { ReactNode } from "react";
import {
  DECISOES_DENUNCIA,
  PERMISSOES,
  ROTULOS_PERMISSAO,
  ROTULOS_TIPO_DENUNCIA,
  TIPOS_DENUNCIA,
  type AlvoDenuncia,
} from "@/modules/administracao";
import { PALAVRA_CONFIRMACAO_ENCERRAMENTO } from "@/modules/contas";
import {
  acaoCancelarEncerramento,
  acaoConcederPermissao,
  acaoDecidirDenuncia,
  acaoDenunciar,
  acaoInvalidarIndicacao,
  acaoReativarConta,
  acaoRevogarPermissao,
  acaoSincronizarAcesso,
  acaoSolicitarEncerramento,
  acaoSuspenderConta,
} from "../acoes-ciclo-vida";
import type { EstadoCicloVida } from "../_lib/estado-ciclo-vida";
import {
  validarContaMotivo,
  validarDecisaoDenuncia,
  validarDenuncia,
  validarEncerramento,
  validarInvalidacao,
  validarPermissao,
} from "../_lib/validacao-ciclo-vida";
import { Campo } from "./campos";
import { CampoSelect, CampoTextoLongo } from "./campos-conteudo";
import { FormAcao } from "./form-acao";
import { Aviso, BotaoEnviar } from "./ui";
import { useFormulario } from "./use-formulario";

/**
 * Formulários da Fase 6 (IM-076, IM-077, IM-080, IM-081). Botão travado durante o envio (IM-028); validação no
 * navegador com os mesmos schemas do servidor; mensagens neutras vindas do servidor.
 */
type Acao = (estado: EstadoCicloVida, dados: FormData) => Promise<EstadoCicloVida>;
type Validador = (d: Record<string, string>) => Record<string, string> | null;

function Mensagens({ estado }: { estado: EstadoCicloVida }) {
  return (
    <>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
    </>
  );
}

function Ocultos({ campos }: { campos: Record<string, string> }) {
  return (
    <>
      {Object.entries(campos).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

const AJUDA_AUDITORIA = "Fica registrado na auditoria.";

/** Moldura comum: hook de formulário + mensagens + campos ocultos + botão. */
function Moldura({
  acao,
  validar,
  ocultos = {},
  rotuloBotao,
  rotuloEnviando,
  secundario,
  perigo,
  children,
}: {
  acao: Acao;
  validar: Validador;
  ocultos?: Record<string, string>;
  rotuloBotao: string;
  rotuloEnviando: string;
  secundario?: boolean;
  perigo?: boolean;
  children: (p: { estado: EstadoCicloVida; erros: Record<string, string> }) => ReactNode;
}) {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } =
    useFormulario<EstadoCicloVida>(acao, validar);
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      <Mensagens estado={estado} />
      <Ocultos campos={ocultos} />
      {children({ estado, erros })}
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

const ROTULO_ALVO: Record<AlvoDenuncia, string> = {
  perfil: "este perfil",
  item: "este item",
  conta: "esta conta",
  pedido: "este pedido",
  indicacao: "esta indicação",
};

/**
 * IM-076: denúncia aberta a qualquer pessoa, logada ou não. A origem (hash de IP e navegador) é calculada no
 * servidor. O campo "site" é a armadilha de robôs: fora do foco e escondido de leitores de tela. A resposta é
 * sempre a mesma mensagem neutra.
 */
export function FormDenunciar({ alvoTipo, alvoId }: { alvoTipo: AlvoDenuncia; alvoId: string }) {
  return (
    <details className="secao-denuncia">
      <summary className="botao-texto">Denunciar</summary>
      <Moldura
        acao={acaoDenunciar}
        validar={validarDenuncia}
        ocultos={{ alvoTipo, alvoId }}
        rotuloBotao="Enviar denúncia"
        rotuloEnviando="Enviando..."
        secundario
      >
        {({ estado, erros }) => (
          <>
            <p className="ajuda">
              Use para avisar a equipe sobre {ROTULO_ALVO[alvoTipo]}. Ninguém é suspenso
              automaticamente: a equipe analisa cada caso. Quem é denunciado nunca vê quem enviou.
            </p>
            <CampoSelect
              nome="tipo"
              rotulo="Motivo da denúncia"
              valorInicial={estado.valores?.tipo}
              erro={erros.tipo}
              opcoes={TIPOS_DENUNCIA.map((t) => ({ valor: t, rotulo: ROTULOS_TIPO_DENUNCIA[t] }))}
            />
            <CampoTextoLongo
              nome="texto"
              rotulo="Detalhes"
              opcional
              linhas={3}
              valorInicial={estado.valores?.texto}
              erro={erros.texto}
              ajuda="Texto curto, até 500 caracteres. Não informe dados pessoais seus."
            />
            <div className="campo-armadilha" aria-hidden="true">
              <label>
                Não preencha este campo
                <input type="text" name="site" tabIndex={-1} autoComplete="off" defaultValue="" />
              </label>
            </div>
            <p className="ajuda">
              Para evitar abusos, há um limite de denúncias por pessoa em um período.
            </p>
          </>
        )}
      </Moldura>
    </details>
  );
}

/** IM-076: decisão com motivo. A decisão NÃO executa nenhuma suspensão. */
export function FormDecidirDenuncia({ denunciaId }: { denunciaId: string }) {
  return (
    <Moldura
      acao={acaoDecidirDenuncia}
      validar={validarDecisaoDenuncia}
      ocultos={{ denunciaId }}
      rotuloBotao="Registrar decisão"
      rotuloEnviando="Registrando..."
    >
      {({ estado, erros }) => (
        <>
          <CampoSelect
            nome="decisao"
            rotulo="Decisão"
            vazio="Escolha a decisão"
            valorInicial={estado.valores?.decisao}
            erro={erros.decisao}
            opcoes={DECISOES_DENUNCIA.map((d) => ({
              valor: d,
              rotulo:
                d === "em_analise"
                  ? "Em análise"
                  : d === "procedente"
                    ? "Procedente"
                    : "Improcedente",
            }))}
          />
          <CampoTextoLongo
            nome="motivo"
            rotulo="Motivo da decisão"
            linhas={2}
            valorInicial={estado.valores?.motivo}
            erro={erros.motivo}
            ajuda={`${AJUDA_AUDITORIA} Decidir não suspende conta nenhuma.`}
          />
        </>
      )}
    </Moldura>
  );
}

/** IM-077: conceder permissão (só administrador geral). */
export function FormConcederPermissao() {
  return (
    <Moldura
      acao={acaoConcederPermissao}
      validar={validarPermissao}
      rotuloBotao="Conceder permissão"
      rotuloEnviando="Concedendo..."
    >
      {({ estado, erros }) => (
        <>
          <Campo
            nome="contaId"
            rotulo="Identificador da conta"
            valorInicial={estado.valores?.contaId}
            erro={erros.contaId}
            ajuda="Código da conta que vai receber a permissão."
          />
          <CampoSelect
            nome="permissao"
            rotulo="Permissão"
            vazio="Escolha a permissão"
            valorInicial={estado.valores?.permissao}
            erro={erros.permissao}
            opcoes={PERMISSOES.map((p) => ({ valor: p, rotulo: ROTULOS_PERMISSAO[p] }))}
          />
          <CampoTextoLongo
            nome="motivo"
            rotulo="Motivo"
            linhas={2}
            valorInicial={estado.valores?.motivo}
            erro={erros.motivo}
            ajuda={AJUDA_AUDITORIA}
          />
        </>
      )}
    </Moldura>
  );
}

export function FormRevogarPermissao({
  contaId,
  permissao,
}: {
  contaId: string;
  permissao: string;
}) {
  return (
    <Moldura
      acao={acaoRevogarPermissao}
      validar={validarPermissao}
      ocultos={{ contaId, permissao }}
      rotuloBotao="Revogar permissão"
      rotuloEnviando="Revogando..."
      perigo
    >
      {({ estado, erros }) => (
        <CampoTextoLongo
          nome="motivo"
          rotulo="Motivo da revogação"
          linhas={2}
          valorInicial={estado.valores?.motivo}
          erro={erros.motivo}
          ajuda={AJUDA_AUDITORIA}
        />
      )}
    </Moldura>
  );
}

/** IM-080: suspender, com motivo. Ação explícita e auditada; nada é automático. */
export function FormSuspenderConta() {
  return (
    <Moldura
      acao={acaoSuspenderConta}
      validar={validarContaMotivo}
      rotuloBotao="Suspender conta"
      rotuloEnviando="Suspendendo..."
      perigo
    >
      {({ estado, erros }) => (
        <>
          <Campo
            nome="contaId"
            rotulo="Identificador da conta"
            valorInicial={estado.valores?.contaId}
            erro={erros.contaId}
            ajuda="Suspensa, a conta não entra, perfis e itens saem do ar e ela não recebe contatos."
          />
          <CampoTextoLongo
            nome="motivo"
            rotulo="Motivo da suspensão"
            linhas={2}
            valorInicial={estado.valores?.motivo}
            erro={erros.motivo}
            ajuda={AJUDA_AUDITORIA}
          />
        </>
      )}
    </Moldura>
  );
}

export function FormReativarConta({ contaId }: { contaId: string }) {
  return (
    <Moldura
      acao={acaoReativarConta}
      validar={validarContaMotivo}
      ocultos={{ contaId }}
      rotuloBotao="Reativar conta"
      rotuloEnviando="Reativando..."
    >
      {({ estado, erros }) => (
        <CampoTextoLongo
          nome="motivo"
          rotulo="Motivo da reativação"
          linhas={2}
          valorInicial={estado.valores?.motivo}
          erro={erros.motivo}
          ajuda={`${AJUDA_AUDITORIA} Os perfis voltam despublicados.`}
        />
      )}
    </Moldura>
  );
}

/** Repete o bloqueio/liberação no login quando a primeira tentativa falhou (IM-080). */
export function FormSincronizarAcesso() {
  return (
    <Moldura
      acao={acaoSincronizarAcesso}
      validar={(d) => validarContaMotivo({ contaId: d.contaId ?? "", motivo: "x" })}
      rotuloBotao="Sincronizar acesso"
      rotuloEnviando="Sincronizando..."
      secundario
    >
      {({ estado, erros }) => (
        <Campo
          nome="contaId"
          rotulo="Identificador da conta"
          valorInicial={estado.valores?.contaId}
          erro={erros.contaId}
          ajuda="Aplica de novo o bloqueio (conta suspensa) ou a liberação (conta ativa) do login."
        />
      )}
    </Moldura>
  );
}

/**
 * IM-077: invalidar indicação. Reverte só os pontos (não altera a base de relacionamento nem o pedido). Se o saldo
 * ficaria negativo, o banco avisa e a confirmação explícita aparece.
 */
export function FormInvalidarIndicacao({ pedidoId }: { pedidoId?: string }) {
  return (
    <Moldura
      acao={acaoInvalidarIndicacao}
      validar={validarInvalidacao}
      ocultos={pedidoId ? { pedidoId } : {}}
      rotuloBotao="Invalidar indicação"
      rotuloEnviando="Invalidando..."
      perigo
    >
      {({ estado, erros }) => (
        <>
          {pedidoId ? null : (
            <Campo
              nome="pedidoId"
              rotulo="Identificador do pedido"
              valorInicial={estado.valores?.pedidoId}
              erro={erros.pedidoId}
              ajuda="Código do pedido de contato que gerou a indicação."
            />
          )}
          <CampoTextoLongo
            nome="motivo"
            rotulo="Motivo da invalidação"
            linhas={2}
            valorInicial={estado.valores?.motivo}
            erro={erros.motivo}
            ajuda={AJUDA_AUDITORIA}
          />
          {estado.pedirConfirmacao ? (
            <div className="campo-marcar">
              <label>
                <input type="checkbox" name="confirmarSaldoNegativo" value="sim" />
                Confirmo invalidar mesmo deixando o saldo desta pessoa negativo
              </label>
            </div>
          ) : null}
        </>
      )}
    </Moldura>
  );
}

/** IM-081: encerrar a própria conta digitando a palavra de confirmação. */
export function FormEncerrarConta() {
  return (
    <Moldura
      acao={acaoSolicitarEncerramento}
      validar={validarEncerramento}
      rotuloBotao="Encerrar minha conta"
      rotuloEnviando="Enviando..."
      perigo
    >
      {({ estado, erros }) => (
        <Campo
          nome="confirmacao"
          rotulo={`Digite ${PALAVRA_CONFIRMACAO_ENCERRAMENTO} para confirmar`}
          valorInicial={estado.valores?.confirmacao}
          erro={erros.confirmacao}
          autoComplete="off"
        />
      )}
    </Moldura>
  );
}

export function FormDesistirEncerramento() {
  return (
    <FormAcao
      acao={acaoCancelarEncerramento}
      campos={{}}
      rotulo="Desistir do encerramento"
      rotuloEnviando="Cancelando..."
    />
  );
}
