"use client";

import { useActionState, useState } from "react";
import {
  acaoAlterarEnderecoPerfil,
  acaoCriarPerfil,
  acaoEditarPerfil,
  acaoSalvarImagensPerfil,
} from "../acoes-conteudo";
import type { CategoriaOpcao } from "../_lib/apresentacao";
import { ESTADO_INICIAL } from "../_lib/estado-formulario";
import { validarEdicaoPerfil, validarNovoPerfil } from "../_lib/validacao-conteudo";
import { Campo, CampoWhatsapp } from "./campos";
import { CampoTextoLongo, CamposCategorias, CampoUF } from "./campos-conteudo";
import { GerenciadorImagens, type ImagemDoCampo } from "./gerenciador-imagens";
import { Aviso, BotaoEnviar } from "./ui";
import { useFormulario } from "./use-formulario";

type Valores = Record<string, string>;

/** Campos do perfil (IM-011, IM-012). Os mesmos no cadastro e na edição. */
function CamposPerfil({
  valores,
  erros,
  categorias,
  comEndereco,
}: {
  valores: Valores;
  erros: Record<string, string>;
  categorias: readonly CategoriaOpcao[];
  comEndereco?: boolean;
}) {
  const v = (n: string) => valores[n] ?? "";
  return (
    <>
      <Campo nome="nome" rotulo="Nome do perfil" valorInicial={v("nome")} erro={erros.nome} />
      <CampoTextoLongo
        nome="descricaoBreve"
        rotulo="Descrição breve"
        valorInicial={v("descricaoBreve")}
        erro={erros.descricaoBreve}
        ajuda="Conte em poucas palavras o que você faz (até 280 caracteres)."
        linhas={3}
      />
      <CamposCategorias
        categorias={categorias}
        principal={v("categoriaPrincipalId")}
        secundarias={[v("categoriaSecundaria1"), v("categoriaSecundaria2")]}
        erros={erros}
      />
      <Campo
        nome="cidade"
        rotulo="Cidade"
        autoComplete="address-level2"
        valorInicial={v("cidade")}
        erro={erros.cidade}
      />
      <CampoUF valorInicial={v("uf")} erro={erros.uf} />
      <CampoWhatsapp
        nome="whatsappComercial"
        rotulo="WhatsApp comercial"
        valorInicial={v("whatsappComercial")}
        erro={erros.whatsappComercial}
        ajuda="Usado só para o contato. Não aparece na página pública."
      />
      {comEndereco ? (
        <Campo
          nome="slug"
          rotulo="Endereço da página"
          opcional
          valorInicial={v("slug")}
          erro={erros.slug}
          ajuda="Letras minúsculas, números e hífen. Se deixar em branco, usamos o nome. Não muda depois da primeira aprovação."
        />
      ) : null}
      <h2>Informações opcionais</h2>
      <Campo
        nome="endereco"
        rotulo="Endereço"
        opcional
        autoComplete="street-address"
        valorInicial={v("endereco")}
        erro={erros.endereco}
      />
      <CampoTextoLongo
        nome="areasAtendidas"
        rotulo="Áreas atendidas"
        opcional
        valorInicial={v("areasAtendidas")}
        erro={erros.areasAtendidas}
        ajuda="Separe por vírgula. Exemplo: Centro, Zona Sul, Canoas."
        linhas={2}
      />
      <Campo
        nome="site"
        rotulo="Site"
        opcional
        inputMode="text"
        valorInicial={v("site")}
        erro={erros.site}
        ajuda="Endereço do seu site. Redes sociais não são aceitas por enquanto."
      />
      <CampoTextoLongo
        nome="informacoesSociais"
        rotulo="Informações sociais"
        opcional
        valorInicial={v("informacoesSociais")}
        erro={erros.informacoesSociais}
        ajuda="Somente texto: sem links nem @ de redes sociais."
        linhas={3}
      />
    </>
  );
}

export function FormNovoPerfil({ categorias }: { categorias: readonly CategoriaOpcao[] }) {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario(
    acaoCriarPerfil,
    validarNovoPerfil,
  );
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      <CamposPerfil
        valores={estado.valores ?? {}}
        erros={erros}
        categorias={categorias}
        comEndereco
      />
      <p className="ajuda">
        As imagens são enviadas na próxima tela, depois que o rascunho for criado.
      </p>
      <BotaoEnviar enviando={enviando} rotulo="Criar rascunho" rotuloEnviando="Criando..." />
    </form>
  );
}

export function FormEditarPerfil({
  perfilId,
  inicial,
  categorias,
}: {
  perfilId: string;
  inicial: Valores;
  categorias: readonly CategoriaOpcao[];
}) {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario(
    acaoEditarPerfil,
    validarEdicaoPerfil,
  );
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <input type="hidden" name="id" value={perfilId} />
      <CamposPerfil
        valores={{ ...inicial, ...estado.valores }}
        erros={erros}
        categorias={categorias}
      />
      <BotaoEnviar enviando={enviando} rotulo="Salvar alterações" rotuloEnviando="Salvando..." />
    </form>
  );
}

export function FormEnderecoPerfil({ perfilId, slug }: { perfilId: string; slug: string }) {
  const [estado, action, enviando] = useActionState(acaoAlterarEnderecoPerfil, ESTADO_INICIAL);
  return (
    <form action={action} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <input type="hidden" name="id" value={perfilId} />
      <Campo
        nome="slug"
        rotulo="Endereço da página"
        valorInicial={estado.valores?.slug ?? slug}
        erro={estado.erros?.slug}
        ajuda="Só pode mudar antes da primeira aprovação."
      />
      <BotaoEnviar
        enviando={enviando}
        rotulo="Salvar endereço"
        rotuloEnviando="Salvando..."
        secundario
      />
    </form>
  );
}

/** Imagem do perfil, até 3 banners e até 6 fotos (D-006). Enviadas direto ao Storage; aqui só os caminhos. */
export function FormImagensPerfil({
  perfilId,
  imagem,
  banners,
  fotos,
}: {
  perfilId: string;
  imagem: readonly ImagemDoCampo[];
  banners: readonly ImagemDoCampo[];
  fotos: readonly ImagemDoCampo[];
}) {
  const [estado, action, enviando] = useActionState(acaoSalvarImagensPerfil, ESTADO_INICIAL);
  const [ocupados, setOcupados] = useState<Record<string, boolean>>({});
  const marcar = (campo: string) => (ocupado: boolean) =>
    setOcupados((o) => (o[campo] === ocupado ? o : { ...o, [campo]: ocupado }));
  const enviandoImagem = Object.values(ocupados).some(Boolean);
  const erros = estado.erros ?? {};
  return (
    <form action={action} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <input type="hidden" name="id" value={perfilId} />
      <GerenciadorImagens
        nome="imagemPath"
        rotulo="Imagem do perfil"
        pasta="perfil"
        donoId={perfilId}
        limite={1}
        inicial={imagem}
        erro={erros.imagemPath}
        onOcupado={marcar("imagem")}
        ajuda="Obrigatória para enviar à aprovação."
      />
      <GerenciadorImagens
        nome="bannersPaths"
        rotulo="Banners"
        pasta="perfil"
        donoId={perfilId}
        limite={3}
        inicial={banners}
        erro={erros.bannersPaths}
        onOcupado={marcar("banners")}
        ajuda="Opcional. Até 3."
      />
      <GerenciadorImagens
        nome="fotosPaths"
        rotulo="Fotos"
        pasta="perfil"
        donoId={perfilId}
        limite={6}
        inicial={fotos}
        erro={erros.fotosPaths}
        onOcupado={marcar("fotos")}
        ajuda="Opcional. Até 6."
      />
      <BotaoEnviar
        enviando={enviando || enviandoImagem}
        rotulo="Salvar imagens"
        rotuloEnviando={enviandoImagem ? "Enviando imagem..." : "Salvando..."}
      />
    </form>
  );
}
