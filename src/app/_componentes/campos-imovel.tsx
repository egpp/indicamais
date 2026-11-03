"use client";

import {
  FINALIDADES_IMOVEL,
  ROTULOS_FINALIDADE_IMOVEL,
  ROTULOS_TIPO_IMOVEL,
  TIPOS_IMOVEL,
} from "@/modules/catalogo";
import { Campo } from "./campos";
import { CampoSelect, CampoUF } from "./campos-conteudo";

type Valores = Record<string, string>;

/**
 * Campos do imóvel da Loja (IM-098, D-020). Só apresentação: formatos e limites são do módulo catalogo (o mesmo
 * schema valida no navegador e no servidor). Não há campo de endereço exato: só bairro, cidade e UF (IM-029).
 * No aluguel, o valor do preço é mensal.
 */
export function CamposImovel({
  valores,
  erros,
}: {
  valores: Valores;
  erros: Record<string, string>;
}) {
  const v = (n: string) => valores[n] ?? "";
  const numero = (nome: string, rotulo: string) => (
    <Campo
      nome={nome}
      rotulo={rotulo}
      inputMode="numeric"
      valorInicial={v(nome)}
      erro={erros[nome]}
    />
  );
  return (
    <fieldset className="campo grupo-imovel">
      <legend>Dados do imóvel</legend>
      <CampoSelect
        nome="imovelTipo"
        rotulo="Tipo do imóvel"
        vazio="Escolha o tipo"
        valorInicial={v("imovelTipo")}
        erro={erros.imovelTipo}
        opcoes={TIPOS_IMOVEL.map((t) => ({ valor: t, rotulo: ROTULOS_TIPO_IMOVEL[t] }))}
      />
      <CampoSelect
        nome="finalidade"
        rotulo="Finalidade"
        vazio="Venda ou aluguel"
        valorInicial={v("finalidade")}
        erro={erros.finalidade}
        opcoes={FINALIDADES_IMOVEL.map((f) => ({ valor: f, rotulo: ROTULOS_FINALIDADE_IMOVEL[f] }))}
        ajuda="No aluguel, o preço informado é o valor mensal."
      />
      <Campo
        nome="areaM2"
        rotulo="Área (m²)"
        inputMode="text"
        valorInicial={v("areaM2")}
        erro={erros.areaM2}
        ajuda="Exemplo: 85 ou 85,5"
      />
      <div className="linha-campos">
        {numero("quartos", "Quartos")}
        {numero("banheiros", "Banheiros")}
        {numero("vagas", "Vagas")}
      </div>
      <Campo
        nome="bairro"
        rotulo="Bairro"
        autoComplete="off"
        valorInicial={v("bairro")}
        erro={erros.bairro}
        ajuda="Só o bairro e a cidade aparecem ao público. O endereço exato não é divulgado."
      />
      <Campo
        nome="cidade"
        rotulo="Cidade"
        autoComplete="address-level2"
        valorInicial={v("cidade")}
        erro={erros.cidade}
      />
      <CampoUF valorInicial={v("uf")} erro={erros.uf} />
      <Campo
        nome="condominio"
        rotulo="Condomínio (R$ por mês)"
        opcional
        inputMode="text"
        valorInicial={v("condominio")}
        erro={erros.condominioCentavos}
        ajuda="Exemplo: 450,00. Use 0 se não houver."
      />
      <Campo
        nome="iptu"
        rotulo="IPTU (R$)"
        opcional
        inputMode="text"
        valorInicial={v("iptu")}
        erro={erros.iptuCentavos}
        ajuda="Exemplo: 120,00. Use 0 se não houver."
      />
      <CampoSelect
        nome="aceitaFinanciamento"
        rotulo="Aceita financiamento"
        opcional
        vazio="Não informar"
        valorInicial={v("aceitaFinanciamento")}
        erro={erros.aceitaFinanciamento}
        opcoes={[
          { valor: "true", rotulo: "Sim" },
          { valor: "false", rotulo: "Não" },
        ]}
      />
    </fieldset>
  );
}

/** Texto neutro quando o perfil não tem a Loja. Não promete plano nem preço (IM-099). */
export const TEXTO_LOJA_NAO_LIBERADA = "Loja não liberada para este perfil.";
