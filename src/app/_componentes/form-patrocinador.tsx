"use client";

import { useState } from "react";
import {
  acaoAlterarPatrocinador,
  acaoCriarPatrocinador,
  acaoDefinirPatrocinadorAtivo,
} from "../acoes-patrocinadores";
import {
  validarAlterarPatrocinador,
  validarCriarPatrocinador,
  validarDefinirAtivo,
} from "../_lib/validacao-patrocinadores";
import { Campo } from "./campos";
import { CampoSelect, CampoTextoLongo } from "./campos-conteudo";
import { GerenciadorImagens, type ImagemDoCampo } from "./gerenciador-imagens";
import { Aviso, BotaoEnviar } from "./ui";
import { useFormulario } from "./use-formulario";

type Valores = Record<string, string>;
export type PerfilOpcao = { id: string; nome: string };

/**
 * Campos comuns de criar e alterar. Datas em horário de Brasília (o servidor converte para UTC). O destino é um
 * perfil publicado OU um texto sem link: preencha só um. Não há campo de preço, plano nem URL externa (D-008).
 */
function CamposPatrocinador({
  id,
  valores,
  erros,
  perfis,
  imagem,
  onImagemOcupada,
  motivoObrigatorio,
}: {
  id: string;
  valores: Valores;
  erros: Record<string, string>;
  perfis: readonly PerfilOpcao[];
  imagem: readonly ImagemDoCampo[];
  onImagemOcupada: (ocupado: boolean) => void;
  motivoObrigatorio: boolean;
}) {
  const v = (n: string) => valores[n] ?? "";
  return (
    <>
      <input type="hidden" name="id" value={id} />
      <Campo nome="titulo" rotulo="Título" valorInicial={v("titulo")} erro={erros.titulo} />
      <GerenciadorImagens
        nome="imagemPath"
        rotulo="Imagem do patrocinador"
        pasta="patrocinador"
        donoId={id}
        limite={1}
        inicial={imagem}
        erro={erros.imagemPath}
        onOcupado={onImagemOcupada}
        ajuda="Obrigatória."
      />
      <CampoSelect
        nome="perfilDestinoId"
        rotulo="Perfil de destino"
        opcional
        vazio="Nenhum (usar texto)"
        valorInicial={v("perfilDestinoId")}
        erro={erros.perfilDestinoId}
        opcoes={perfis.map((p) => ({ valor: p.id, rotulo: p.nome }))}
        ajuda="Só perfis publicados. Preencha o perfil OU o texto, não os dois."
      />
      <CampoTextoLongo
        nome="textoDestino"
        rotulo="Texto de destino"
        opcional
        valorInicial={v("textoDestino")}
        erro={erros.textoDestino}
        linhas={2}
        ajuda="Sem link, endereço de site nem @usuário."
      />
      <Campo
        nome="ordem"
        rotulo="Ordem no carrossel"
        inputMode="numeric"
        valorInicial={v("ordem") || "0"}
        erro={erros.ordem}
        ajuda="Menor número aparece primeiro."
      />
      <Campo
        nome="inicioEm"
        rotulo="Início (horário de Brasília)"
        tipo="datetime-local"
        opcional
        valorInicial={v("inicioEm")}
        erro={erros.inicioEm}
      />
      <Campo
        nome="fimEm"
        rotulo="Fim (horário de Brasília)"
        tipo="datetime-local"
        opcional
        valorInicial={v("fimEm")}
        erro={erros.fimEm}
      />
      <CampoTextoLongo
        nome="motivo"
        rotulo="Motivo"
        opcional={!motivoObrigatorio}
        valorInicial={v("motivo")}
        erro={erros.motivo}
        linhas={2}
        ajuda="Fica registrado na auditoria."
      />
    </>
  );
}

export function FormNovoPatrocinador({
  novoId,
  perfis,
}: {
  /** Gerado no servidor ANTES do upload: a imagem vai para patrocinador/<id>/. */
  novoId: string;
  perfis: readonly PerfilOpcao[];
}) {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario(
    acaoCriarPatrocinador,
    validarCriarPatrocinador,
  );
  const [enviandoImagem, setEnviandoImagem] = useState(false);
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      <CamposPatrocinador
        id={novoId}
        valores={estado.valores ?? {}}
        erros={erros}
        perfis={perfis}
        imagem={[]}
        onImagemOcupada={setEnviandoImagem}
        motivoObrigatorio={false}
      />
      <div className="campo-marcar">
        <label>
          <input type="checkbox" name="ativo" value="sim" defaultChecked={false} />
          Colocar no ar ao criar
        </label>
      </div>
      <BotaoEnviar
        enviando={enviando || enviandoImagem}
        rotulo="Criar patrocinador"
        rotuloEnviando={enviandoImagem ? "Enviando imagem..." : "Criando..."}
      />
    </form>
  );
}

export function FormEditarPatrocinador({
  id,
  inicial,
  imagem,
  perfis,
}: {
  id: string;
  inicial: Valores;
  imagem: readonly ImagemDoCampo[];
  perfis: readonly PerfilOpcao[];
}) {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario(
    acaoAlterarPatrocinador,
    validarAlterarPatrocinador,
  );
  const [enviandoImagem, setEnviandoImagem] = useState(false);
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <CamposPatrocinador
        id={id}
        valores={{ ...inicial, ...estado.valores }}
        erros={erros}
        perfis={perfis}
        imagem={imagem}
        onImagemOcupada={setEnviandoImagem}
        motivoObrigatorio
      />
      <BotaoEnviar
        enviando={enviando || enviandoImagem}
        rotulo="Salvar alterações"
        rotuloEnviando={enviandoImagem ? "Enviando imagem..." : "Salvando..."}
      />
    </form>
  );
}

/** Ativar ou desativar: o motivo é obrigatório e vai para a auditoria. Não existe exclusão. */
export function FormAtivarPatrocinador({ id, ativo }: { id: string; ativo: boolean }) {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario(
    acaoDefinirPatrocinadorAtivo,
    validarDefinirAtivo,
  );
  const rotulo = ativo ? "Desativar" : "Ativar";
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="ativo" value={ativo ? "nao" : "sim"} />
      <CampoTextoLongo
        nome="motivo"
        rotulo={`Motivo para ${rotulo.toLowerCase()}`}
        valorInicial={estado.valores?.motivo}
        erro={erros.motivo}
        linhas={2}
      />
      <BotaoEnviar
        enviando={enviando}
        rotulo={rotulo}
        rotuloEnviando={ativo ? "Desativando..." : "Ativando..."}
        perigo={ativo}
      />
    </form>
  );
}
