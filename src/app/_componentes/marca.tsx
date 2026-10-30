import Image from "next/image";
import Link from "next/link";

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

/** Rodapé comum a todas as telas. */
export function RodapeSite() {
  return (
    <footer className="rodape-site">
      <div className="rodape-site-conteudo">
        <Image
          src="/marca/logo-escuro.png"
          alt="IndicaMais"
          width={LARGURA}
          height={ALTURA}
          unoptimized
        />
        <p>
          <Link href="/politica-de-privacidade">Política de privacidade</Link>
        </p>
      </div>
    </footer>
  );
}
