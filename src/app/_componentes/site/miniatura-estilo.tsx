/* eslint-disable @next/next/no-img-element -- ilustração local (data URI) da demonstração. */
import { ilustracaoDemo } from "./demonstracao";
import type { TemaEstilo } from "./estilos";
import { classeDeFontes } from "./fontes";
import { Decoracao } from "./icones";
import "./site.css";
import "./site-estilos.css";
import "./site-estilos-novos.css";

const NOMES_EXEMPLO: Record<string, string> = {
  minimalista: "Estúdio Exemplo",
  gastronomia: "Cantina Exemplo",
  saude_bem_estar: "Clínica Exemplo",
  beleza_estetica: "Espaço Exemplo",
  construcao_reformas: "Obras Exemplo",
  cafe_padaria: "Padaria Exemplo",
  automotivo: "Auto Exemplo",
  juridico_contabil: "Escritório Exemplo",
  educacao_cursos: "Escola Exemplo",
  pet: "Pet Shop Exemplo",
  moda_lojas: "Loja Exemplo",
  fitness_esportes: "Academia Exemplo",
  imobiliario: "Imobiliária Exemplo",
  tecnologia_assistencia: "Assistência Exemplo",
  casa_decoracao: "Casa Exemplo",
  eventos_fotografia: "Estúdio Exemplo",
  servicos_rapidos: "Resolve Exemplo",
  agro_campo: "Casa do Campo Exemplo",
  turismo_hospedagem: "Pousada Exemplo",
  premium: "Ateliê Exemplo",
  moto_bike: "Giro Exemplo",
};

/**
 * Miniatura de um estilo (D-016; IM-091), feita em HTML e CSS com as mesmas variáveis do tema real e o conteúdo de
 * demonstração (nome fictício, ilustrações locais), marcada como "Exemplo". Decorativa (aria-hidden): o nome do
 * estilo está no texto ao lado. Estilo sem desenho pronto mostra um quadro neutro.
 */
export function MiniaturaEstilo({ tema }: { tema: TemaEstilo }) {
  if (!tema.liberado) {
    return (
      <div className="st-mini st-mini-breve" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    );
  }
  const nome = NOMES_EXEMPLO[tema.id] ?? "Seu negócio";
  return (
    <div className={`site site-${tema.id} st-mini ${classeDeFontes(tema.id)}`} aria-hidden="true">
      <div className="st-mini-menu">
        <b>{nome}</b>
        <i />
      </div>
      <div className="st-mini-hero">
        <Decoracao estilo={tema.id} />
        <div className="st-mini-hero-texto">
          <b className="st-mini-titulo">{nome}</b>
          <span className="st-mini-botao">Falar com a empresa</span>
        </div>
      </div>
      <div className="st-mini-corpo">
        {[0, 1, 2].map((n) => (
          <div key={n} className="st-mini-card">
            <img src={ilustracaoDemo(tema.id, n)} alt="" />
            <b>Item {n + 1}</b>
          </div>
        ))}
      </div>
      <span className="st-mini-exemplo">
        <span className="st-selo-exemplo">Exemplo</span>
      </span>
    </div>
  );
}
