"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { acaoEnviarContato } from "../acoes-indicacoes";
import type { EstadoContato } from "../_lib/estado-indicacoes";
import { validarContato } from "../_lib/validacao-indicacoes";
import { Campo, CampoWhatsapp } from "./campos";
import { CampoTextoLongo } from "./campos-conteudo";
import { Aviso, BotaoEnviar } from "./ui";
import { useFormulario } from "./use-formulario";

const ATRASO_REDIRECIONAMENTO_MS = 2500;

/** Só endereços do WhatsApp (wa.me) viram link ou redirecionamento. */
const ehWhatsapp = (u: string | undefined): u is string => Boolean(u?.startsWith("https://wa.me/"));

/**
 * Formulário de contato do visitante, sem cadastro (IM-026). A chave de idempotência vem do servidor uma vez
 * por formulário renderizado e é reaproveitada em qualquer novo envio (IM-028). `ind` é o código do link de
 * indicação da URL deste MESMO destino (IM-025): vai só neste formulário, nunca para cookie nem armazenamento.
 */
export function FormContato({
  tipo,
  id,
  slug,
  chave,
  ind,
}: {
  tipo: "perfil" | "item";
  id?: string;
  slug?: string;
  chave: string;
  ind?: string;
}) {
  const [chaveFixa] = useState(chave);
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario<EstadoContato>(
    acaoEnviarContato,
    validarContato,
  );
  const url = ehWhatsapp(estado.urlWhatsapp) ? estado.urlWhatsapp : undefined;

  useEffect(() => {
    if (!url) return;
    const t = setTimeout(() => window.location.assign(url), ATRASO_REDIRECIONAMENTO_MS);
    return () => clearTimeout(t);
  }, [url]);

  if (url) {
    return (
      <div className="confirmacao-contato">
        <Aviso tipo="sucesso">{estado.sucesso}</Aviso>
        <p>Vamos abrir o WhatsApp do responsável para você continuar a conversa.</p>
        <a className="botao" href={url} target="_blank" rel="noopener noreferrer">
          Abrir WhatsApp
        </a>
      </div>
    );
  }

  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      <input type="hidden" name="tipo" value={tipo} />
      {id ? <input type="hidden" name="id" value={id} /> : null}
      {slug ? <input type="hidden" name="slug" value={slug} /> : null}
      <input type="hidden" name="chave" value={chaveFixa} />
      {ind ? <input type="hidden" name="ind" value={ind} /> : null}
      <Campo
        nome="nome"
        rotulo="Seu nome"
        autoComplete="name"
        valorInicial={estado.valores?.nome}
        erro={erros.nome}
      />
      <CampoWhatsapp
        rotulo="Seu WhatsApp"
        valorInicial={estado.valores?.whatsapp}
        erro={erros.whatsapp}
        ajuda="Com DDD. O responsável poderá responder por este número."
      />
      <Campo
        nome="email"
        rotulo="Seu e-mail"
        tipo="email"
        opcional
        autoComplete="email"
        inputMode="email"
        valorInicial={estado.valores?.email}
        erro={erros.email}
      />
      <CampoTextoLongo
        nome="mensagem"
        rotulo="Mensagem"
        opcional
        linhas={4}
        valorInicial={estado.valores?.mensagem}
        erro={erros.mensagem}
      />
      <p className="ajuda">
        Seus dados (nome, WhatsApp, e-mail e mensagem) serão enviados somente ao responsável por
        este perfil ou anúncio, para ele responder ao seu pedido. Veja a{" "}
        <Link href="/politica-de-privacidade">política de privacidade (texto provisório)</Link>.
      </p>
      <BotaoEnviar
        enviando={enviando}
        rotulo="Enviar pedido de contato"
        rotuloEnviando="Enviando..."
      />
    </form>
  );
}
