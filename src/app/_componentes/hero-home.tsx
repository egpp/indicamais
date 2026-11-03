/* eslint-disable @next/next/no-img-element -- arte estática do logotipo, sem otimização necessária. */
import Link from "next/link";
import type { FiltrosDisponiveis, TipoBusca } from "@/modules/busca";
import { IconeHome, type NomeIconeHome } from "./icones-home";
import { ROTULO_TIPO_BUSCA, type ValoresFiltro } from "./publico";

/**
 * Destaque da página inicial: título, busca em barra (texto, cidade, UF, Buscar) e faixa de vantagens. A busca é o
 * mesmo formulário GET de antes (funciona sem JavaScript, links compartilháveis); tipo e categoria ficam em "Mais
 * filtros" (recolhido). Só texto honesto: nada aqui promete o que o sistema não faz.
 */
const VANTAGENS: ReadonlyArray<{ icone: NomeIconeHome; titulo: string; texto: string }> = [
  { icone: "escudo", titulo: "Empresas aprovadas", texto: "Só aparece o que passou pela revisão" },
  { icone: "pessoas", titulo: "Indicações de pessoas reais", texto: "Quem indica tem conta" },
  { icone: "presente", titulo: "Ganhe pontos", texto: "A cada indicação válida" },
  { icone: "conversa", titulo: "Contato direto", texto: "Fale com o responsável" },
];

function Arte() {
  return (
    <div className="hero-arte" aria-hidden="true">
      <svg
        aria-hidden="true"
        className="hero-formas"
        viewBox="0 0 1200 520"
        preserveAspectRatio="xMaxYMid slice"
        focusable="false"
      >
        <defs>
          <linearGradient id="hero-grad-onda" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fd6d29" stopOpacity="0" />
            <stop offset="1" stopColor="#fd6d29" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <circle
          cx="930"
          cy="250"
          r="330"
          fill="none"
          stroke="#fd6d29"
          strokeOpacity="0.18"
          strokeWidth="2"
        />
        <circle
          cx="930"
          cy="250"
          r="250"
          fill="none"
          stroke="#fd6d29"
          strokeOpacity="0.25"
          strokeWidth="2"
        />
        <circle
          cx="930"
          cy="250"
          r="170"
          fill="none"
          stroke="#fd6d29"
          strokeOpacity="0.35"
          strokeWidth="2"
        />
        <path d="M0 470c180-40 330-40 520-10s330 40 680-30V520H0z" fill="url(#hero-grad-onda)" />
        <path
          d="M0 500c220-30 380-20 560 0s380 20 640-20V520H0z"
          fill="#fd5140"
          fillOpacity="0.22"
        />
        <g fill="#fff" fillOpacity="0.07">
          <rect x="640" y="330" width="46" height="190" rx="3" />
          <rect x="696" y="290" width="58" height="230" rx="3" />
          <rect x="764" y="350" width="40" height="170" rx="3" />
          <rect x="1050" y="310" width="52" height="210" rx="3" />
          <rect x="1112" y="360" width="44" height="160" rx="3" />
        </g>
      </svg>
      <div className="hero-pin">
        <span className="hero-pin-corpo">
          <img src="/marca/icone-quadrado.png" alt="" width={512} height={512} />
        </span>
        <span className="hero-pin-sombra" />
      </div>
    </div>
  );
}

export function HeroHome({
  filtros,
  valores,
  compacto,
}: {
  filtros: FiltrosDisponiveis | null;
  valores: ValoresFiltro;
  /** Resultado de busca: hero menor, sem a faixa de vantagens. */
  compacto?: boolean;
}) {
  const partes: string[] = [];
  if (valores.termo) partes.push(valores.termo);
  if (valores.tipo && valores.tipo in ROTULO_TIPO_BUSCA)
    partes.push(ROTULO_TIPO_BUSCA[valores.tipo as TipoBusca]);
  if (valores.categoriaId) {
    const cat = filtros?.categorias.find((c) => c.id === valores.categoriaId);
    if (cat) partes.push(cat.nome);
  }
  const local = [valores.cidade, valores.uf].filter(Boolean).join("/");
  if (local) partes.push(local);
  const extras = [valores.tipo, valores.categoriaId].filter(Boolean).length;
  const ativos = [
    valores.termo,
    valores.tipo,
    valores.categoriaId,
    valores.cidade,
    valores.uf,
  ].filter(Boolean).length;

  return (
    <section className={compacto ? "hero hero-compacto" : "hero"} aria-labelledby="titulo-hero">
      <Arte />
      <div className="hero-conteudo">
        <h1 id="titulo-hero">
          Encontre empresas, profissionais, <span className="destaque">produtos e serviços</span>
        </h1>
        <p className="hero-subtitulo">
          O que você precisa, perto de você, com indicações de verdade.
        </p>

        <form className="hero-busca" method="get" action="/" role="search" aria-label="Buscar">
          <div className="hero-barra">
            <div className="hero-campo hero-campo-termo">
              <label htmlFor="f-termo" className="so-leitor">
                Buscar pelo nome
              </label>
              <IconeHome nome="busca" tamanho={20} />
              <input
                id="f-termo"
                name="termo"
                type="search"
                defaultValue={valores.termo ?? ""}
                maxLength={80}
                autoComplete="off"
                placeholder="Buscar empresas, produtos ou serviços..."
              />
            </div>
            <div className="hero-campo hero-campo-local">
              <IconeHome nome="local" tamanho={20} />
              <label htmlFor="f-cidade" className="so-leitor">
                Cidade
              </label>
              <input
                id="f-cidade"
                name="cidade"
                type="text"
                defaultValue={valores.cidade ?? ""}
                maxLength={80}
                autoComplete="address-level2"
                placeholder="Cidade"
              />
              <label htmlFor="f-uf" className="so-leitor">
                UF
              </label>
              <select id="f-uf" name="uf" defaultValue={valores.uf ?? ""}>
                <option value="">UF</option>
                {(filtros?.ufs ?? []).map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="hero-botao-buscar">
              Buscar
            </button>
          </div>

          <details className="busca-recolhida" open={extras > 0}>
            <summary>
              <span>Mais filtros</span>
              {extras > 0 ? (
                <span className="busca-contagem">
                  {extras === 1 ? "1 filtro" : `${extras} filtros`}
                </span>
              ) : null}
              <IconeHome nome="seta-baixo" tamanho={18} className="busca-chevron" />
            </summary>
            <div className="filtros-busca">
              <div className="campo">
                <label htmlFor="f-tipo">Tipo</label>
                <select id="f-tipo" name="tipo" defaultValue={valores.tipo ?? ""}>
                  <option value="">Todos</option>
                  <option value="perfil">Empresas e profissionais</option>
                  <option value="produto">Produtos</option>
                  <option value="servico">Serviços</option>
                </select>
              </div>
              <div className="campo">
                <label htmlFor="f-categoria">Categoria</label>
                <select
                  id="f-categoria"
                  name="categoriaId"
                  defaultValue={valores.categoriaId ?? ""}
                >
                  <option value="">Todas</option>
                  {(filtros?.categorias ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
              <p className="ajuda">Use Buscar para aplicar os filtros.</p>
            </div>
          </details>
          {ativos > 0 ? (
            <p className="hero-resumo">
              <span className="hero-resumo-texto">Buscando por: {partes.join(" · ")}</span>
              <span className="busca-contagem">
                {ativos === 1 ? "1 filtro" : `${ativos} filtros`}
              </span>
              <Link href="/">Limpar filtros</Link>
            </p>
          ) : null}
        </form>

        {compacto ? null : (
          <ul className="hero-vantagens" aria-label="Vantagens do IndicaMais">
            {VANTAGENS.map((v) => (
              <li key={v.titulo}>
                <IconeHome nome={v.icone} tamanho={34} />
                <span>
                  <strong>{v.titulo}</strong>
                  <small>{v.texto}</small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
