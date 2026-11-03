"use client";

import { acaoDefinirLiberacaoLoja } from "../acoes-loja";
import { validarLiberacaoLoja } from "../_lib/validacao-loja";
import { CampoTextoLongo } from "./campos-conteudo";
import { Aviso, BotaoEnviar } from "./ui";
import { useFormulario } from "./use-formulario";

/**
 * Libera ou retira a Loja de um perfil (administrador geral, IM-097, IM-099, D-020). O motivo é obrigatório e vai
 * para a auditoria no banco. Botão travado durante o envio (IM-028). Só para testes: sem plano nem cobrança.
 */
export function FormLiberacaoLoja({
  perfilId,
  nome,
  liberada,
}: {
  perfilId: string;
  nome: string;
  /** Estado atual: o formulário faz o contrário. */
  liberada: boolean;
}) {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario(
    acaoDefinirLiberacaoLoja,
    validarLiberacaoLoja,
  );
  const liberar = !liberada;
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <input type="hidden" name="perfilId" value={perfilId} />
      <input type="hidden" name="liberada" value={liberar ? "true" : "false"} />
      <CampoTextoLongo
        nome="motivo"
        rotulo={`Motivo para ${liberar ? "liberar" : "retirar"} a Loja de ${nome}`}
        valorInicial={estado.valores?.motivo}
        erro={erros.motivo}
        linhas={2}
        ajuda="Obrigatório. Fica registrado na auditoria."
      />
      <BotaoEnviar
        enviando={enviando}
        rotulo={liberar ? "Liberar a Loja" : "Retirar a Loja"}
        rotuloEnviando={liberar ? "Liberando..." : "Retirando..."}
        secundario={!liberar}
      />
    </form>
  );
}
