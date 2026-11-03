import Image from "next/image";
import Link from "next/link";
import { UFS } from "@/shared/conteudo/ufs";

/** Proporção do arquivo otimizado (560 x 94). Largura/altura evitam salto de layout. */
const LARGURA = 560;
const ALTURA = 94;

/** Logotipo do IndicaMais como link para a página inicial (alvo de toque de 44px). */
export function LogoMarca({ escuro }: { escuro?: boolean }) {
  return (
    <p className="marca">
      <Link href="/">
        <Image
          src={escuro ? "/marca/logo-escuro.png" : "/marca/logo-claro.png"}
          alt="IndicaMais"
          width={LARGURA}
          height={ALTURA}
          priority
          unoptimized
        />
      </Link>
    </p>
  );
}

/**
 * Rodapé comum a todas as telas: logotipo, colunas de navegação, seletor de estado (leva à busca por UF) e direitos.
 * Só links para páginas do próprio IndicaMais: sem redes sociais (IM-012) e sem páginas que não existem.
 */
export function RodapeSite() {
  return (
    <footer className="rodape-site">
      <div className="rodape-grade">
        <div className="rodape-marca">
          <Image
            src="/marca/logo-escuro.png"
            alt="IndicaMais"
            width={LARGURA}
            height={ALTURA}
            unoptimized
          />
          <p>Conectando você aos melhores negócios da sua região.</p>
        </div>
        <nav className="rodape-coluna" aria-labelledby="rodape-navegacao">
          <h2 id="rodape-navegacao">Navegação</h2>
          <ul>
            <li>
              <Link href="/">Início</Link>
            </li>
            <li>
              <Link href="/categorias">Categorias</Link>
            </li>
            <li>
              <Link href="/como-funciona">Como funciona</Link>
            </li>
            <li>
              <Link href="/indique-e-ganhe">Indique e Ganhe</Link>
            </li>
          </ul>
        </nav>
        <nav className="rodape-coluna" aria-labelledby="rodape-empresas">
          <h2 id="rodape-empresas">Para empresas</h2>
          <ul>
            <li>
              <Link href="/meus-perfis/novo">Cadastre sua empresa</Link>
            </li>
            <li>
              <Link href="/beneficios">Benefícios para quem indica</Link>
            </li>
          </ul>
        </nav>
        <nav className="rodape-coluna" aria-labelledby="rodape-ajuda">
          <h2 id="rodape-ajuda">Ajuda</h2>
          <ul>
            <li>
              <Link href="/ajuda">Dúvidas frequentes</Link>
            </li>
            <li>
              <Link href="/politica-de-privacidade">Política de privacidade</Link>
            </li>
          </ul>
        </nav>
        <div className="rodape-lateral">
          <form method="get" action="/" className="rodape-estado" aria-label="Buscar por estado">
            <label htmlFor="rodape-uf">Ver empresas do estado</label>
            <div>
              <select id="rodape-uf" name="uf" defaultValue="">
                <option value="" disabled>
                  Escolha o estado
                </option>
                {UFS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <button type="submit">Ir</button>
            </div>
          </form>
          <p className="rodape-direitos">
            © {new Date().getFullYear()} IndicaMais. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
