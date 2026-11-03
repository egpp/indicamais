"use client";

import { useActionState, useState } from "react";
import {
  acaoCriarItem,
  acaoEditarItem,
  acaoSalvarFotoItem,
  acaoSalvarFotosExtrasItem,
} from "../acoes-conteudo";
import type { CategoriaOpcao } from "../_lib/apresentacao";
import { ESTADO_INICIAL } from "../_lib/estado-formulario";
import { validarEdicaoItem, validarNovoItem } from "../_lib/validacao-conteudo";
import { LIMITES } from "@/shared/config/limites";
import { Campo } from "./campos";
import { CamposImovel, TEXTO_LOJA_NAO_LIBERADA } from "./campos-imovel";
import {
  CampoSelect,
  CampoTextoLongo,
  CampoUF,
  CamposCategorias,
  CamposPreco,
} from "./campos-conteudo";
import { GerenciadorImagens, type ImagemDoCampo } from "./gerenciador-imagens";
import { Aviso, BotaoEnviar } from "./ui";
import { useFormulario } from "./use-formulario";

type Valores = Record<string, string>;

function CamposItem({
  valores,
  erros,
  categorias,
  anuncio,
  imovel,
}: {
  valores: Valores;
  erros: Record<string, string>;
  categorias: readonly CategoriaOpcao[];
  /** Anúncio particular: cidade e UF obrigatórias (D-008). Item de perfil usa a localização do perfil. */
  anuncio: boolean;
  /** Imóvel da Loja (IM-098): mostra os campos de imóvel, com cidade e UF próprias. */
  imovel: boolean;
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
      {imovel ? <CamposImovel valores={valores} erros={erros} /> : null}
      {anuncio && !imovel ? (
        <>
          <Campo
            nome="cidade"
            rotulo="Cidade"
            autoComplete="address-level2"
            valorInicial={v("cidade")}
            erro={erros.cidade}
            ajuda="Onde o produto está. Aparece nos filtros por cidade e UF."
          />
          <CampoUF valorInicial={v("uf")} erro={erros.uf} />
        </>
      ) : null}
      <CamposPreco
        modoInicial={v("precoModo")}
        valorInicial={v("precoValor")}
        erros={erros}
        imovel={imovel}
      />
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
  perfisComLoja = [],
}: {
  origem: "perfil" | "anuncio";
  categorias: readonly CategoriaOpcao[];
  perfis?: readonly { id: string; nome: string }[];
  perfilInicial?: string;
  /** Ids dos perfis com a Loja liberada (IM-099): só neles o tipo Imóvel e seus campos aparecem. */
  perfisComLoja?: readonly string[];
}) {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario(
    acaoCriarItem,
    validarNovoItem,
  );
  const v = estado.valores ?? {};
  const [perfilSel, setPerfilSel] = useState(v.perfilId ?? perfilInicial ?? "");
  const [tipoSel, setTipoSel] = useState(v.tipo ?? "");
  const lojaDoPerfil = perfisComLoja.includes(perfilSel);
  // Trocar para um perfil sem a Loja desfaz a escolha de imóvel.
  const tipo = tipoSel === "imovel" && !lojaDoPerfil ? "" : tipoSel;
  const imovel = origem === "perfil" && tipo === "imovel";
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
            valor={perfilSel}
            aoMudar={setPerfilSel}
            erro={erros.perfilId}
            opcoes={(perfis ?? []).map((p) => ({ valor: p.id, rotulo: p.nome }))}
          />
          <CampoSelect
            nome="tipo"
            rotulo="Tipo"
            vazio="Escolha o tipo"
            valor={tipo}
            aoMudar={setTipoSel}
            erro={erros.tipo}
            opcoes={[
              { valor: "produto", rotulo: "Produto" },
              { valor: "servico", rotulo: "Serviço" },
              ...(lojaDoPerfil ? [{ valor: "imovel", rotulo: "Imóvel" }] : []),
            ]}
          />
          {perfilSel && !lojaDoPerfil ? <p className="ajuda">{TEXTO_LOJA_NAO_LIBERADA}</p> : null}
        </>
      ) : (
        <input type="hidden" name="tipo" value="produto" />
      )}
      <CamposItem
        valores={v}
        erros={erros}
        categorias={categorias}
        anuncio={origem === "anuncio"}
        imovel={imovel}
      />
      <p className="ajuda">
        A foto
        {imovel ? " e as fotos adicionais são enviadas" : " é enviada"} na próxima tela, depois que
        o rascunho for criado.
      </p>
      <BotaoEnviar enviando={enviando} rotulo="Criar rascunho" rotuloEnviando="Criando..." />
    </form>
  );
}

export function FormEditarItem({
  itemId,
  inicial,
  categorias,
  anuncioParticular = false,
  tipo = "produto",
}: {
  itemId: string;
  inicial: Valores;
  categorias: readonly CategoriaOpcao[];
  anuncioParticular?: boolean;
  tipo?: "produto" | "servico" | "imovel";
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
      <input type="hidden" name="origem" value={anuncioParticular ? "anuncio" : "perfil"} />
      <input type="hidden" name="tipo" value={tipo} />
      <CamposItem
        valores={{ ...inicial, ...estado.valores }}
        erros={erros}
        categorias={categorias}
        anuncio={anuncioParticular}
        imovel={tipo === "imovel"}
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

/** Fotos adicionais do imóvel (Loja, IM-097): até 8, na pasta item/<id>/, como a foto principal. */
export function FormFotosExtrasItem({
  itemId,
  fotos,
}: {
  itemId: string;
  fotos: readonly ImagemDoCampo[];
}) {
  const [estado, action, enviando] = useActionState(acaoSalvarFotosExtrasItem, ESTADO_INICIAL);
  const [enviandoImagem, setEnviandoImagem] = useState(false);
  return (
    <form action={action} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <input type="hidden" name="id" value={itemId} />
      <GerenciadorImagens
        nome="fotosExtrasPaths"
        rotulo="Fotos adicionais"
        pasta="item"
        donoId={itemId}
        limite={LIMITES.imovel.fotosExtrasMax}
        inicial={fotos}
        erro={estado.erros?.fotosExtrasPaths}
        onOcupado={setEnviandoImagem}
        ajuda={`Até ${LIMITES.imovel.fotosExtrasMax} fotos, além da foto principal.`}
      />
      <BotaoEnviar
        enviando={enviando || enviandoImagem}
        rotulo="Salvar fotos adicionais"
        rotuloEnviando={enviandoImagem ? "Enviando imagem..." : "Salvando..."}
      />
    </form>
  );
}
