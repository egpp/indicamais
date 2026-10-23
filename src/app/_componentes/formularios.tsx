"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  atualizarNome,
  atualizarWhatsapp,
  cadastrar,
  entrar,
  entrarComGoogle,
  redefinirSenha,
  reenviarConfirmacao,
  solicitarRecuperacao,
} from "../acoes-conta";
import { ESTADO_INICIAL } from "../_lib/estado-formulario";
import { MENSAGEM_EMAIL_NAO_CONFIRMADO } from "../_lib/mensagens-auth";
import {
  validarCadastro,
  validarEmail,
  validarLogin,
  validarNome,
  validarRedefinicao,
  validarReenvio,
  validarWhatsapp,
} from "../_lib/validacao";
import { Campo, CampoSenha, CampoWhatsapp } from "./campos";
import { Aviso, BotaoEnviar } from "./ui";
import { useFormulario } from "./use-formulario";

export function FormCadastro() {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario(
    cadastrar,
    validarCadastro,
  );
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? (
        <Aviso tipo="sucesso">
          {estado.sucesso}{" "}
          <Link href="/reenviar-confirmacao">Não recebeu? Reenviar confirmação</Link>
        </Aviso>
      ) : null}
      <Campo
        nome="nomeExibicao"
        rotulo="Nome"
        opcional
        autoComplete="name"
        valorInicial={estado.valores?.nomeExibicao}
        erro={erros.nomeExibicao}
      />
      <Campo
        nome="email"
        rotulo="E-mail"
        tipo="email"
        inputMode="email"
        autoComplete="email"
        valorInicial={estado.valores?.email}
        erro={erros.email}
      />
      <CampoSenha
        nome="senha"
        rotulo="Senha"
        autoComplete="new-password"
        ajuda="Mínimo de 8 caracteres, com pelo menos uma letra e um número."
        erro={erros.senha}
      />
      <BotaoEnviar enviando={enviando} rotulo="Criar conta" rotuloEnviando="Criando conta..." />
    </form>
  );
}

export function FormEntrar({ proximo }: { proximo?: string }) {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario(
    entrar,
    validarLogin,
  );
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? (
        <Aviso tipo="erro">
          {estado.erro}{" "}
          {estado.erro === MENSAGEM_EMAIL_NAO_CONFIRMADO ? (
            <Link href="/reenviar-confirmacao">Reenviar confirmação</Link>
          ) : null}
        </Aviso>
      ) : null}
      {proximo ? <input type="hidden" name="proximo" value={proximo} /> : null}
      <Campo
        nome="email"
        rotulo="E-mail"
        tipo="email"
        inputMode="email"
        autoComplete="email"
        valorInicial={estado.valores?.email}
        erro={erros.email}
      />
      <CampoSenha nome="senha" rotulo="Senha" autoComplete="current-password" erro={erros.senha} />
      <BotaoEnviar enviando={enviando} rotulo="Entrar" rotuloEnviando="Entrando..." />
    </form>
  );
}

export function BotaoGoogle({ proximo }: { proximo?: string }) {
  const [estado, action, enviando] = useActionState(entrarComGoogle, ESTADO_INICIAL);
  return (
    <form action={action}>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {proximo ? <input type="hidden" name="proximo" value={proximo} /> : null}
      <BotaoEnviar
        enviando={enviando}
        rotulo="Entrar com Google"
        rotuloEnviando="Abrindo o Google..."
        secundario
      />
    </form>
  );
}

export function FormRecuperarSenha() {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario(
    solicitarRecuperacao,
    validarEmail,
  );
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <Campo
        nome="email"
        rotulo="E-mail"
        tipo="email"
        inputMode="email"
        autoComplete="email"
        valorInicial={estado.valores?.email}
        erro={erros.email}
      />
      <BotaoEnviar enviando={enviando} rotulo="Enviar instruções" />
    </form>
  );
}

export function FormReenviarConfirmacao() {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario(
    reenviarConfirmacao,
    validarReenvio,
  );
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <Campo
        nome="email"
        rotulo="E-mail"
        tipo="email"
        inputMode="email"
        autoComplete="email"
        valorInicial={estado.valores?.email}
        erro={erros.email}
      />
      <BotaoEnviar enviando={enviando} rotulo="Reenviar confirmação" />
    </form>
  );
}

export function FormRedefinirSenha() {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario(
    redefinirSenha,
    validarRedefinicao,
  );
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      <CampoSenha
        nome="novaSenha"
        rotulo="Nova senha"
        autoComplete="new-password"
        ajuda="Mínimo de 8 caracteres, com pelo menos uma letra e um número."
        erro={erros.novaSenha}
      />
      <CampoSenha
        nome="confirmacao"
        rotulo="Confirme a nova senha"
        autoComplete="new-password"
        erro={erros.confirmacao}
      />
      <BotaoEnviar enviando={enviando} rotulo="Salvar nova senha" rotuloEnviando="Salvando..." />
    </form>
  );
}

export function FormNome({ nomeAtual }: { nomeAtual: string }) {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario(
    atualizarNome,
    validarNome,
  );
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <Campo
        nome="nomeExibicao"
        rotulo="Nome"
        autoComplete="name"
        valorInicial={estado.valores?.nomeExibicao ?? nomeAtual}
        erro={erros.nomeExibicao}
      />
      <BotaoEnviar enviando={enviando} rotulo="Salvar nome" rotuloEnviando="Salvando..." />
    </form>
  );
}

export function FormWhatsapp({ whatsappAtual }: { whatsappAtual: string }) {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario(
    atualizarWhatsapp,
    validarWhatsapp,
  );
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <CampoWhatsapp
        valorInicial={estado.valores?.whatsapp ?? whatsappAtual}
        erro={erros.whatsapp}
        ajuda="Com DDD. Exemplo: (11) 99999-0001."
      />
      <BotaoEnviar enviando={enviando} rotulo="Salvar WhatsApp" rotuloEnviando="Salvando..." />
    </form>
  );
}
