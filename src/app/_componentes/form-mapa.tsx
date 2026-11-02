"use client";

import { useActionState } from "react";
import type { MapaUrls } from "@/modules/perfis";
import {
  acaoDefinirMostrarMapa,
  acaoInformarCoordenadas,
  acaoLocalizarNoMapa,
  acaoRemoverCoordenadas,
} from "../acoes-localizacao";
import { ESTADO_INICIAL } from "../_lib/estado-formulario";
import { validarCoordenadas } from "../_lib/validacao-localizacao";
import { Campo } from "./campos";
import { MapaLocalizacao } from "./site/mapa-localizacao";
import "./site/site.css";
import { Aviso, BotaoEnviar } from "./ui";
import { useFormulario } from "./use-formulario";

/**
 * Seção "Mapa" do painel (D-016; IM-018, IM-092). Só apresentação e formulários: a regra (geocodificação,
 * versão aprovada, coordenadas) está no módulo perfis. O mapa é fornecido pelo OpenStreetMap.
 */
export const TEXTO_MAPA_APROVACAO =
  "O mapa só aparece na página depois que a versão do perfil for aprovada.";
export const TEXTO_MAPA_OSM =
  "O mapa é fornecido pelo OpenStreetMap: ao abrir sua página, o navegador do visitante carrega o mapa do site do OpenStreetMap.";

export type PropsSecaoMapa = {
  perfilId: string;
  nome: string;
  mostrarMapa: boolean;
  latitude: number | null;
  longitude: number | null;
  urls: MapaUrls | null;
  temEndereco: boolean;
};

function Interruptor({ perfilId, ligado }: { perfilId: string; ligado: boolean }) {
  const [estado, action, enviando] = useActionState(acaoDefinirMostrarMapa, ESTADO_INICIAL);
  return (
    <form action={action} className="mapa-interruptor">
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <input type="hidden" name="id" value={perfilId} />
      <input type="hidden" name="mostrar" value={ligado ? "false" : "true"} />
      <button
        type="submit"
        role="switch"
        aria-checked={ligado}
        className={ligado ? "botao" : "botao botao-secundario"}
        disabled={enviando}
        aria-disabled={enviando}
      >
        {enviando
          ? "Salvando..."
          : ligado
            ? "Mostrar mapa na minha página: ligado"
            : "Mostrar mapa na minha página: desligado"}
      </button>
    </form>
  );
}

function BotaoAcao({
  acao,
  perfilId,
  rotulo,
  rotuloEnviando,
  secundario,
  perigo,
}: {
  acao: typeof acaoLocalizarNoMapa;
  perfilId: string;
  rotulo: string;
  rotuloEnviando: string;
  secundario?: boolean;
  perigo?: boolean;
}) {
  const [estado, action, enviando] = useActionState(acao, ESTADO_INICIAL);
  return (
    <form action={action}>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <input type="hidden" name="id" value={perfilId} />
      <BotaoEnviar
        enviando={enviando}
        rotulo={rotulo}
        rotuloEnviando={rotuloEnviando}
        secundario={secundario}
        perigo={perigo}
      />
    </form>
  );
}

function FormCoordenadas({ perfilId }: { perfilId: string }) {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario(
    acaoInformarCoordenadas,
    validarCoordenadas,
  );
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <input type="hidden" name="id" value={perfilId} />
      <Campo
        nome="latitude"
        rotulo="Latitude"
        inputMode="text"
        valorInicial={estado.valores?.latitude}
        erro={erros.latitude}
        ajuda="Exemplo: -9,665 (entre -90 e 90)."
      />
      <Campo
        nome="longitude"
        rotulo="Longitude"
        inputMode="text"
        valorInicial={estado.valores?.longitude}
        erro={erros.longitude}
        ajuda="Exemplo: -35,735 (entre -180 e 180). No Brasil, a longitude é negativa."
      />
      <BotaoEnviar
        enviando={enviando}
        rotulo="Salvar coordenadas"
        rotuloEnviando="Salvando..."
        secundario
      />
    </form>
  );
}

export function SecaoMapa({
  perfilId,
  nome,
  mostrarMapa,
  latitude,
  longitude,
  urls,
  temEndereco,
}: PropsSecaoMapa) {
  const temCoordenada = latitude !== null && longitude !== null;
  return (
    <div className="secao-mapa">
      <p className="ajuda">{TEXTO_MAPA_APROVACAO}</p>
      <p className="ajuda">{TEXTO_MAPA_OSM}</p>
      <ul className="mapa-situacao" aria-label="Situação do mapa">
        <li>
          <strong>Mapa na página:</strong> {mostrarMapa ? "ligado" : "desligado"}
        </li>
        <li>
          <strong>Coordenadas da versão aprovada:</strong>{" "}
          {temCoordenada ? `${latitude}, ${longitude}` : "ainda não há"}
        </li>
      </ul>
      <Interruptor perfilId={perfilId} ligado={mostrarMapa} />
      {urls ? <MapaLocalizacao nome={nome} urls={urls} /> : null}
      {temEndereco ? (
        <BotaoAcao
          acao={acaoLocalizarNoMapa}
          perfilId={perfilId}
          rotulo="Localizar no mapa"
          rotuloEnviando="Localizando..."
          secundario
        />
      ) : (
        <Aviso tipo="info">Preencha endereço, cidade e UF para localizar no mapa.</Aviso>
      )}
      {temEndereco ? (
        <details className="mapa-manual">
          <summary className="botao-texto">Informar coordenadas manualmente</summary>
          <p className="ajuda">
            Use se o endereço não for encontrado ou o ponto estiver errado. Copie a latitude e a
            longitude do local no OpenStreetMap.
          </p>
          <FormCoordenadas perfilId={perfilId} />
        </details>
      ) : null}
      {temCoordenada || temEndereco ? (
        <BotaoAcao
          acao={acaoRemoverCoordenadas}
          perfilId={perfilId}
          rotulo="Remover coordenadas"
          rotuloEnviando="Removendo..."
          perigo
        />
      ) : null}
    </div>
  );
}
