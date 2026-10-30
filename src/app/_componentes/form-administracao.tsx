"use client";

import {
  acaoAlterarCategoria,
  acaoCriarCategoria,
  acaoDecidirRevisao,
  acaoDecidirSolicitacao,
  acaoSolicitarCategoria,
} from "../acoes-conteudo";
import {
  validarAlteracaoCategoria,
  validarCriacaoCategoria,
  validarDecisaoRevisao,
  validarDecisaoSolicitacao,
  validarSolicitacaoCategoria,
} from "../_lib/validacao-conteudo";
import { Campo } from "./campos";
import { CampoSelect, CampoTextoLongo } from "./campos-conteudo";
import { Aviso, BotaoEnviar } from "./ui";
import { useFormulario } from "./use-formulario";

/** Pedido de nova categoria pelo responsável (IM-016). */
export function FormSolicitarCategoria() {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario(
    acaoSolicitarCategoria,
    validarSolicitacaoCategoria,
  );
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <Campo
        nome="nome"
        rotulo="Nome da categoria"
        valorInicial={estado.valores?.nome}
        erro={erros.nome}
      />
      <CampoTextoLongo
        nome="justificativa"
        rotulo="Por que precisa dela?"
        opcional
        valorInicial={estado.valores?.justificativa}
        erro={erros.justificativa}
        linhas={3}
      />
      <BotaoEnviar enviando={enviando} rotulo="Enviar pedido" rotuloEnviando="Enviando..." />
    </form>
  );
}

/** Aprovar (observação opcional) ou rejeitar (motivo obrigatório, IM-023). */
export function FormDecidirRevisao({
  modo,
  alvo,
  versaoId,
}: {
  modo: "aprovar" | "rejeitar";
  alvo: "perfil" | "item";
  versaoId: string;
}) {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario(
    acaoDecidirRevisao,
    validarDecisaoRevisao,
  );
  const rejeitar = modo === "rejeitar";
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      <input type="hidden" name="decisao" value={modo} />
      <input type="hidden" name="alvo" value={alvo} />
      <input type="hidden" name="versaoId" value={versaoId} />
      <CampoTextoLongo
        nome="motivo"
        rotulo={rejeitar ? "Motivo da rejeição" : "Observação"}
        opcional={!rejeitar}
        valorInicial={estado.valores?.motivo}
        erro={erros.motivo}
        ajuda={rejeitar ? "O responsável verá este texto." : undefined}
        linhas={3}
      />
      <BotaoEnviar
        enviando={enviando}
        rotulo={rejeitar ? "Rejeitar" : "Aprovar"}
        rotuloEnviando={rejeitar ? "Rejeitando..." : "Aprovando..."}
        perigo={rejeitar}
      />
    </form>
  );
}

export function FormCriarCategoria() {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario(
    acaoCriarCategoria,
    validarCriacaoCategoria,
  );
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <Campo nome="nome" rotulo="Nome" valorInicial={estado.valores?.nome} erro={erros.nome} />
      <Campo
        nome="ordem"
        rotulo="Ordem de exibição"
        opcional
        inputMode="numeric"
        valorInicial={estado.valores?.ordem}
        erro={erros.ordem}
      />
      <BotaoEnviar enviando={enviando} rotulo="Criar categoria" rotuloEnviando="Criando..." />
    </form>
  );
}

/** Altera nome, ordem e situação de uma categoria. O motivo é obrigatório e vai para a auditoria. */
export function FormAlterarCategoria({
  categoria,
}: {
  categoria: { id: string; nome: string; ordem: number; ativa: boolean };
}) {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario(
    acaoAlterarCategoria,
    validarAlteracaoCategoria,
  );
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <input type="hidden" name="id" value={categoria.id} />
      <Campo
        nome="nome"
        rotulo="Nome"
        valorInicial={estado.valores?.nome ?? categoria.nome}
        erro={erros.nome}
      />
      <Campo
        nome="ordem"
        rotulo="Ordem de exibição"
        inputMode="numeric"
        valorInicial={estado.valores?.ordem ?? String(categoria.ordem)}
        erro={erros.ordem}
      />
      <CampoSelect
        nome="ativa"
        rotulo="Situação"
        vazio="Selecione"
        valorInicial={estado.valores?.ativa ?? (categoria.ativa ? "sim" : "nao")}
        erro={erros.ativa}
        opcoes={[
          { valor: "sim", rotulo: "Ativa" },
          { valor: "nao", rotulo: "Inativa" },
        ]}
      />
      <Campo
        nome="motivo"
        rotulo="Motivo da alteração"
        valorInicial={estado.valores?.motivo}
        erro={erros.motivo}
        ajuda="Registrado na auditoria."
      />
      <BotaoEnviar enviando={enviando} rotulo="Salvar categoria" rotuloEnviando="Salvando..." />
    </form>
  );
}

/** Decide um pedido de categoria: atender (escolhendo a categoria já criada) ou recusar com motivo. */
export function FormDecidirSolicitacao({
  modo,
  solicitacaoId,
  categorias,
}: {
  modo: "atender" | "recusar";
  solicitacaoId: string;
  categorias: readonly { id: string; nome: string }[];
}) {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario(
    acaoDecidirSolicitacao,
    validarDecisaoSolicitacao,
  );
  const atender = modo === "atender";
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <input type="hidden" name="id" value={solicitacaoId} />
      <input type="hidden" name="decisao" value={modo} />
      {atender ? (
        <CampoSelect
          nome="categoriaId"
          rotulo="Categoria que atende o pedido"
          vazio="Escolha a categoria"
          erro={erros.categoriaId}
          opcoes={categorias.map((c) => ({ valor: c.id, rotulo: c.nome }))}
        />
      ) : null}
      <Campo
        nome="motivo"
        rotulo={atender ? "Observação" : "Motivo da recusa"}
        opcional={atender}
        valorInicial={estado.valores?.motivo}
        erro={erros.motivo}
      />
      <BotaoEnviar
        enviando={enviando}
        rotulo={atender ? "Atender pedido" : "Recusar pedido"}
        rotuloEnviando="Enviando..."
        secundario={!atender}
      />
    </form>
  );
}
