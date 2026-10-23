"use client";

import { useActionState, useState } from "react";
import { acaoCriarItem, acaoEditarItem, acaoSalvarFotoItem } from "../acoes-conteudo";
import type { CategoriaOpcao } from "../_lib/apresentacao";
import { ESTADO_INICIAL } from "../_lib/estado-formulario";
import { validarEdicaoItem, validarNovoItem } from "../_lib/validacao-conteudo";
import { Campo } from "./campos";
import { CampoSelect, CampoTextoLongo, CamposCategorias, CamposPreco } from "./campos-conteudo";
import { GerenciadorImagens, type ImagemDoCampo } from "./gerenciador-imagens";
import { Aviso, BotaoEnviar } from "./ui";
import { useFormulario } from "./use-formulario";

type Valores = Record<string, string>;

function CamposItem({
  valores,
  erros,
  categorias,
}: {
  valores: Valores;
  erros: Record<string, string>;
  categorias: readonly CategoriaOpcao[];
}) {
  const v = (n: string) => valores[n] ?? "";
  return (
    <>
      <Campo nome="nome" rotulo="Nome" valorInicial={v("nome")} erro={erros.nome} />
      <CampoTextoLongo
        nome="descricao"
        rotulo="Descrição"
        valorInicial={v("descricao")}
        erro={erros.descricao}
        linhas={5}
      />
      <CamposCategorias
        categorias={categorias}
        principal={v("categoriaPrincipalId")}
        secundarias={[v("categoriaSecundaria1"), v("categoriaSecundaria2")]}
        erros={erros}
      />
      <CamposPreco modoInicial={v("precoModo")} valorInicial={v("precoValor")} erros={erros} />
    </>
  );
}

/**
 * Novo item. `origem="perfil"`: produto ou serviço de um dos perfis do responsável (IM-014).
 * `origem="anuncio"`: anúncio particular, sem perfil (IM-015).
 */
export function FormNovoItem({
  origem,
  categorias,
  perfis,
  perfilInicial,
}: {
  origem: "perfil" | "anuncio";
  categorias: readonly CategoriaOpcao[];
  perfis?: readonly { id: string; nome: string }[];
  perfilInicial?: string;
}) {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario(
    acaoCriarItem,
    validarNovoItem,
  );
  const v = estado.valores ?? {};
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      <input type="hidden" name="origem" value={origem} />
      {origem === "perfil" ? (
        <>
          <CampoSelect
            nome="perfilId"
            rotulo="Perfil"
            vazio="Escolha o perfil"
            valorInicial={v.perfilId ?? perfilInicial}
            erro={erros.perfilId}
            opcoes={(perfis ?? []).map((p) => ({ valor: p.id, rotulo: p.nome }))}
          />
          <CampoSelect
            nome="tipo"
            rotulo="Tipo"
            vazio="Escolha o tipo"
            valorInicial={v.tipo}
            erro={erros.tipo}
            opcoes={[
              { valor: "produto", rotulo: "Produto" },
              { valor: "servico", rotulo: "Serviço" },
            ]}
          />
        </>
      ) : (
        <input type="hidden" name="tipo" value="produto" />
      )}
      <CamposItem valores={v} erros={erros} categorias={categorias} />
      <p className="ajuda">A foto é enviada na próxima tela, depois que o rascunho for criado.</p>
      <BotaoEnviar enviando={enviando} rotulo="Criar rascunho" rotuloEnviando="Criando..." />
    </form>
  );
}

export function FormEditarItem({
  itemId,
  inicial,
  categorias,
}: {
  itemId: string;
  inicial: Valores;
  categorias: readonly CategoriaOpcao[];
}) {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario(
    acaoEditarItem,
    validarEdicaoItem,
  );
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <input type="hidden" name="id" value={itemId} />
      <CamposItem
        valores={{ ...inicial, ...estado.valores }}
        erros={erros}
        categorias={categorias}
      />
      <BotaoEnviar enviando={enviando} rotulo="Salvar alterações" rotuloEnviando="Salvando..." />
    </form>
  );
}

/** Foto do item (obrigatória para enviar à aprovação). */
export function FormFotoItem({ itemId, foto }: { itemId: string; foto: readonly ImagemDoCampo[] }) {
  const [estado, action, enviando] = useActionState(acaoSalvarFotoItem, ESTADO_INICIAL);
  const [enviandoImagem, setEnviandoImagem] = useState(false);
  return (
    <form action={action} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <input type="hidden" name="id" value={itemId} />
      <GerenciadorImagens
        nome="fotoPath"
        rotulo="Foto"
        pasta="item"
        donoId={itemId}
        limite={1}
        inicial={foto}
        erro={estado.erros?.fotoPath}
        onOcupado={setEnviandoImagem}
        ajuda="Obrigatória para enviar à aprovação."
      />
      <BotaoEnviar
        enviando={enviando || enviandoImagem}
        rotulo="Salvar foto"
        rotuloEnviando={enviandoImagem ? "Enviando imagem..." : "Salvando..."}
      />
    </form>
  );
}
