import type { MapaUrls } from "@/modules/perfis";

/**
 * Mapa incorporado do OpenStreetMap na seção "Localização" (D-016; IM-018, IM-092). Só apresentação: as URLs vêm
 * prontas de `montarMapaUrls` (módulo perfis) e só apontam para openstreetmap.org. O iframe é isolado
 * (sandbox mínimo que o embed do OSM aceita), sem referrer e com carregamento preguiçoso.
 */
export const SANDBOX_MAPA =
  "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox";

export function MapaLocalizacao({ nome, urls }: { nome: string; urls: MapaUrls }) {
  return (
    <div className="st-mapa" data-testid="mapa-localizacao">
      <div className="st-mapa-quadro">
        <iframe
          src={urls.embed}
          title={`Mapa da localização de ${nome}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox={SANDBOX_MAPA}
        />
      </div>
      <p className="st-mapa-acoes">
        <a
          className="botao botao-secundario st-botao-auto"
          href={urls.verMaior}
          target="_blank"
          rel="noopener noreferrer"
        >
          Ver mapa maior
          <span className="sr-only"> (abre o OpenStreetMap em outra aba)</span>
        </a>
      </p>
      <p className="ajuda st-mapa-credito">Mapa fornecido pelo OpenStreetMap.</p>
    </div>
  );
}
