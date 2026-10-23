/**
 * Regra de fronteira entre modulos (IM-001, IM-002).
 *
 * - Cada pasta src/modules/<x> e um modulo; seu unico ponto publico e o index.ts.
 * - Quem esta fora do modulo (app, shared, outros modulos) importa somente
 *   `@/modules/<x>` (o index), nunca arquivos internos como `@/modules/<x>/servico`.
 * - Um arquivo de modulo nao sai da propria pasta por caminho relativo
 *   (isso alcancaria outro modulo ou o interior dele); para usar outro modulo,
 *   importe `@/modules/<outro>`; para servicos comuns, `@/shared/...`.
 * - src/shared nao depende de modulos.
 *
 * Implementada com `no-restricted-imports` (regra nativa do ESLint).
 */
const MENSAGEM_INTERNO =
  "Importe apenas o index do modulo (`@/modules/<modulo>`), nunca arquivos internos (IM-001, IM-002).";

const globais = [
  { group: ["@/modules/*/*", "@/modules/*/**"], message: MENSAGEM_INTERNO },
  { group: ["**/modules/*/*", "**/modules/*/**"], message: MENSAGEM_INTERNO },
];

const MODULOS = [
  "contas",
  "perfis",
  "catalogo",
  "busca",
  "indicacoes",
  "pontos",
  "relacionamento",
  "comissoes",
  "administracao",
  "notificacoes",
];

// Raizes dos modulos: codigo real e fixtures de teste da propria regra.
const RAIZES = ["src/modules", "tests/fixtures/modules"];
const PROFUNDIDADE_MAX = 5;

const regra = (padroes) => ({
  "no-restricted-imports": ["error", { patterns: [...globais, ...padroes] }],
});

const config = [
  {
    files: ["src/**/*.{ts,tsx}", "tests/fixtures/**/*.{ts,tsx}"],
    rules: regra([]),
  },
  {
    files: ["src/shared/**/*.{ts,tsx}"],
    rules: regra([
      {
        group: ["@/modules", "@/modules/*"],
        message: "shared nao pode depender de modulos.",
      },
    ]),
  },
];

for (const raiz of RAIZES) {
  for (const modulo of MODULOS) {
    for (let nivel = 0; nivel < PROFUNDIDADE_MAX; nivel++) {
      const subpastas = "*/".repeat(nivel);
      // Arquivo em <modulo>/<nivel subpastas>: "../" x (nivel+1) sai do modulo.
      const saida = "../".repeat(nivel + 1);
      config.push({
        files: [`${raiz}/${modulo}/${subpastas}*.{ts,tsx}`],
        rules: regra([
          {
            group: [`${saida}**`, `${saida.slice(0, -1)}`],
            message:
              "Modulo nao importa fora da propria pasta por caminho relativo; use `@/modules/<outro>` ou `@/shared/...`.",
          },
        ]),
      });
    }
  }
}

export default config;
