"use client";

import { acaoAlterarSecaoHome } from "../acoes-home";
import { validarAlteracaoSecaoHome } from "../_lib/validacao-conteudo";
import { Campo } from "./campos";
import { CampoSelect } from "./campos-conteudo";
import { Aviso, BotaoEnviar } from "./ui";
import { useFormulario } from "./use-formulario";

export type SecaoParaEditar = {
  chave: string;
  titulo: string;
  ativa: boolean;
  ordem: number;
  minimoItens: number;
  limitePadrao: number;
};

/** Edita uma seção em carrossel da home (IM-096). A chave vai oculta (identifica a seção; não é id interno). Motivo obrigatório. */
export function FormAlterarSecaoHome({ secao }: { secao: SecaoParaEditar }) {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario(
    acaoAlterarSecaoHome,
    validarAlteracaoSecaoHome,
  );
  const v = estado.valores;
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <input type="hidden" name="chave" value={secao.chave} />
      <Campo
        nome="titulo"
        rotulo="Título da seção"
        valorInicial={v?.titulo ?? secao.titulo}
        erro={erros.titulo}
        ajuda="De 3 a 40 caracteres, sem link."
      />
      <CampoSelect
        nome="ativa"
        rotulo="Situação"
        vazio="Selecione"
        valorInicial={v?.ativa ?? (secao.ativa ? "true" : "false")}
        erro={erros.ativa}
        opcoes={[
          { valor: "true", rotulo: "Ativa (aparece na página inicial)" },
          { valor: "false", rotulo: "Desativada (não aparece)" },
        ]}
      />
      <Campo
        nome="ordem"
        rotulo="Ordem na página (1 a 99)"
        inputMode="numeric"
        valorInicial={v?.ordem ?? String(secao.ordem)}
        erro={erros.ordem}
      />
      <Campo
        nome="minimoItens"
        rotulo="Mínimo de itens para aparecer (1 a 20)"
        inputMode="numeric"
        valorInicial={v?.minimoItens ?? String(secao.minimoItens)}
        erro={erros.minimoItens}
      />
      <Campo
        nome="limitePadrao"
        rotulo="Máximo de itens no carrossel (1 a 30)"
        inputMode="numeric"
        valorInicial={v?.limitePadrao ?? String(secao.limitePadrao)}
        erro={erros.limitePadrao}
      />
      <Campo
        nome="motivo"
        rotulo="Motivo da alteração"
        valorInicial={v?.motivo}
        erro={erros.motivo}
        ajuda="Obrigatório. Registrado na auditoria."
      />
      <BotaoEnviar enviando={enviando} rotulo="Salvar seção" rotuloEnviando="Salvando..." />
    </form>
  );
}
