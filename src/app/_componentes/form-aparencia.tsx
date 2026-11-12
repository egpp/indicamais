"use client";

/* eslint-disable @next/next/no-img-element -- URLs assinadas do Storage mudam a cada visita; next/image não as otimiza. */
import {
  useActionState,
  useId,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  DESTINOS_SECAO_BANNER,
  TEXTO_ALTERNATIVO_MAX,
  gravarBannersSchema,
  type DestinoSecaoBanner,
} from "@/modules/perfis";
import { LIMITES } from "@/shared/config/limites";
import {
  acaoAdicionarBannerAdmin,
  acaoBannerAtivo,
  acaoHabilitarEstilo,
  acaoRemoverBannerAdmin,
  acaoResponderBanner,
  acaoSalvarBanners,
  acaoSalvarEstilo,
} from "../acoes-aparencia";
import { enviarImagemDeBanner, type ResultadoEnvioBanner } from "../_lib/envio-banner";
import { ESTADO_INICIAL } from "../_lib/estado-formulario";
import {
  validarAdicionarBannerAdmin,
  validarHabilitarEstilo,
  validarRecusaBanner,
  validarRemoverBannerAdmin,
} from "../_lib/validacao-aparencia";
import "./aparencia.css";
import { ROTULOS_DESTINO_BANNER } from "./banners-comum";
import { Campo } from "./campos";
import { CampoSelect, CampoTextoLongo } from "./campos-conteudo";
import { FormAcao } from "./form-acao";
import { Aviso, BotaoEnviar } from "./ui";
import { useFormulario } from "./use-formulario";

const OPCOES_DESTINO = DESTINOS_SECAO_BANNER.map((d) => ({
  valor: d,
  rotulo: ROTULOS_DESTINO_BANNER[d],
}));

// ------------------------------------------------------------------------------------------ estilo do responsável

export type OpcaoEstilo = {
  id: string;
  rotulo: string;
  descricao: string;
  miniatura: ReactNode;
  hrefPrevia: string;
};

/** Escolha do estilo da página (IM-091). Salvar não passa por revisão (IM-094). Botão trava durante o envio (IM-028). */
export function FormEstilo({
  perfilId,
  atual,
  opcoes,
}: {
  perfilId: string;
  atual: string;
  opcoes: readonly OpcaoEstilo[];
}) {
  const [estado, action, enviando] = useActionState(acaoSalvarEstilo, ESTADO_INICIAL);
  const [escolhido, setEscolhido] = useState(atual);
  return (
    <form action={action} className="form-estilo">
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <input type="hidden" name="perfilId" value={perfilId} />
      <fieldset className="grupo-estilos">
        <legend className="sr-only">Estilo da página</legend>
        <ul className="grade-estilos">
          {opcoes.map((o) => (
            <li
              key={o.id}
              className={`cartao cartao-estilo${escolhido === o.id ? " escolhido" : ""}`}
            >
              {o.miniatura}
              <div className="estilo-escolha">
                <input
                  id={`estilo-${o.id}`}
                  type="radio"
                  name="estilo"
                  value={o.id}
                  checked={escolhido === o.id}
                  onChange={() => setEscolhido(o.id)}
                />
                <label htmlFor={`estilo-${o.id}`}>
                  <strong>{o.rotulo}</strong>
                  {o.id === atual ? <span className="selo selo-sucesso"> Estilo atual</span> : null}
                </label>
              </div>
              <p className="ajuda">{o.descricao}</p>
              <p>
                <a className="botao-texto" href={o.hrefPrevia}>
                  Ver prévia<span className="sr-only"> do estilo {o.rotulo}</span>
                </a>
              </p>
            </li>
          ))}
        </ul>
      </fieldset>
      <BotaoEnviar enviando={enviando} rotulo="Salvar estilo" rotuloEnviando="Salvando..." />
    </form>
  );
}

// ------------------------------------------------------------------------------------------ estilo (administrador)

export function FormHabilitarEstilo({
  estilo,
  rotulo,
  habilitar,
}: {
  estilo: string;
  rotulo: string;
  habilitar: boolean;
}) {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario(
    acaoHabilitarEstilo,
    validarHabilitarEstilo,
  );
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <input type="hidden" name="estilo" value={estilo} />
      <input type="hidden" name="habilitado" value={habilitar ? "sim" : "nao"} />
      <CampoTextoLongo
        nome="motivo"
        rotulo={`Motivo para ${habilitar ? "habilitar" : "desabilitar"} ${rotulo}`}
        valorInicial={estado.valores?.motivo}
        erro={erros.motivo}
        linhas={2}
      />
      <BotaoEnviar
        enviando={enviando}
        rotulo={habilitar ? "Habilitar" : "Desabilitar"}
        rotuloEnviando="Salvando..."
        perigo={!habilitar}
      />
    </form>
  );
}

// ------------------------------------------------------------------------------------------ banners do responsável

export type BannerNaTela = {
  /** Caminho no Storage (gravado só depois do envio). */
  caminho: string;
  /** URL de exibição (assinada ou local). */
  url: string | null;
  alt: string;
  destino: DestinoSecaoBanner | null;
  ativo: boolean;
};

type ItemEditor = BannerNaTela & { chave: string };

/**
 * Editor da lista de banners (IM-093): envia as imagens ao Storage ANTES de gravar o caminho, pede o texto
 * alternativo (obrigatório), o destino interno (opcional), a ordem (subir/descer), ativo e remover. Salvar grava a
 * lista inteira no rascunho (a revisão segue o fluxo normal do perfil). Valida com o mesmo schema do servidor.
 */
export function EditorBanners({
  perfilId,
  inicial,
  limite,
  somenteLeitura,
  enviar = enviarImagemDeBanner,
}: {
  perfilId: string;
  inicial: readonly BannerNaTela[];
  /** Quantas imagens próprias cabem (6 menos as do administrador vivas). */
  limite: number;
  somenteLeitura?: boolean;
  enviar?: (arquivo: File, o: { perfilId: string }) => Promise<ResultadoEnvioBanner>;
}) {
  const idCampo = useId();
  const [estado, action, enviando] = useActionState(acaoSalvarBanners, ESTADO_INICIAL);
  const [itens, setItens] = useState<ItemEditor[]>(() =>
    inicial.map((b, i) => ({ ...b, chave: `i${i}-${b.caminho}` })),
  );
  const [subindo, setSubindo] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});

  const lista = itens.map((b) => ({
    imagem_path: b.caminho,
    texto_alternativo: b.alt,
    destino_secao: b.destino,
    ativo: b.ativo,
  }));
  const cheio = itens.length >= limite;
  const maxMb = LIMITES.imagem.tamanhoMaxBytes / (1024 * 1024);

  async function aoEscolher(e: ChangeEvent<HTMLInputElement>) {
    const campo = e.currentTarget;
    const arquivos = Array.from(campo.files ?? []);
    campo.value = "";
    if (arquivos.length === 0) return;
    setMensagem(null);
    setSubindo(true);
    let restante = limite - itens.length;
    const falhas: string[] = [];
    const novos: ItemEditor[] = [];
    try {
      for (const arquivo of arquivos) {
        if (restante <= 0) {
          falhas.push(`O banner aceita no máximo ${limite} imagem(ns) suas.`);
          break;
        }
        const r = await enviar(arquivo, { perfilId });
        if (!r.ok) {
          falhas.push(`${arquivo.name}: ${r.mensagem}`);
          continue;
        }
        novos.push({
          chave: `n-${r.caminho}`,
          caminho: r.caminho,
          url: r.url,
          alt: "",
          destino: null,
          ativo: true,
        });
        restante -= 1;
      }
    } finally {
      setSubindo(false);
    }
    if (novos.length > 0) setItens((atual) => [...atual, ...novos]);
    if (falhas.length > 0) setMensagem(falhas.join(" "));
  }

  const mudar = (chave: string, p: Partial<BannerNaTela>) =>
    setItens((a) => a.map((x) => (x.chave === chave ? { ...x, ...p } : x)));
  function mover(i: number, delta: -1 | 1) {
    setItens((a) => {
      const j = i + delta;
      if (j < 0 || j >= a.length) return a;
      const c = [...a];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  }

  function aoEnviar(e: FormEvent<HTMLFormElement>) {
    if (enviando || subindo) {
      e.preventDefault();
      return;
    }
    const r = gravarBannersSchema(perfilId).safeParse(lista);
    if (r.success) {
      setErros({});
      return;
    }
    e.preventDefault();
    const saida: Record<string, string> = {};
    for (const issue of r.error.issues) {
      const chave = issue.path.length > 0 ? issue.path.join(".") : "_";
      if (!(chave in saida)) saida[chave] = issue.message;
    }
    setErros(saida);
  }

  return (
    <form action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      {erros._ ? <Aviso tipo="erro">{erros._}</Aviso> : null}
      <input type="hidden" name="perfilId" value={perfilId} />
      <input type="hidden" name="banners" value={JSON.stringify(lista)} />

      {itens.length === 0 ? (
        <p className="ajuda">
          Você ainda não tem banners. Sem banner, a página mostra a imagem principal do site.
        </p>
      ) : (
        <ol className="lista-banners" aria-label="Banners do site, na ordem em que aparecem">
          {itens.map((b, i) => {
            const idAlt = `${idCampo}-alt-${i}`;
            const idDest = `${idCampo}-dest-${i}`;
            const erroAlt = erros[`${i}.texto_alternativo`];
            return (
              <li key={b.chave} className="cartao banner-item">
                <div className="banner-miniatura">
                  {b.url ? (
                    <img src={b.url} alt="" loading="lazy" />
                  ) : (
                    <span className="imagem-indisponivel">Imagem sem prévia</span>
                  )}
                  <span className="banner-posicao">Banner {i + 1}</span>
                </div>
                <div className="banner-campos">
                  <div className="campo">
                    <label htmlFor={idAlt}>Descrição da imagem</label>
                    <input
                      id={idAlt}
                      value={b.alt}
                      maxLength={TEXTO_ALTERNATIVO_MAX}
                      disabled={somenteLeitura}
                      aria-invalid={erroAlt ? true : undefined}
                      aria-describedby={erroAlt ? `${idAlt}-erro` : `${idAlt}-ajuda`}
                      onChange={(e) => mudar(b.chave, { alt: e.target.value })}
                    />
                    <p id={`${idAlt}-ajuda`} className="ajuda">
                      Obrigatória. Descreva o que aparece, para quem não enxerga a imagem.
                    </p>
                    {erroAlt ? (
                      <p id={`${idAlt}-erro`} className="erro-campo">
                        {erroAlt}
                      </p>
                    ) : null}
                  </div>
                  <div className="campo">
                    <label htmlFor={idDest}>
                      Ao tocar, levar para <span className="opcional">(opcional)</span>
                    </label>
                    <select
                      id={idDest}
                      value={b.destino ?? ""}
                      disabled={somenteLeitura}
                      onChange={(e) =>
                        mudar(b.chave, {
                          destino: (e.target.value || null) as DestinoSecaoBanner | null,
                        })
                      }
                    >
                      <option value="">Sem destino</option>
                      {OPCOES_DESTINO.map((o) => (
                        <option key={o.valor} value={o.valor}>
                          {o.rotulo}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label className="opcao-linha">
                    <input
                      type="checkbox"
                      checked={b.ativo}
                      disabled={somenteLeitura}
                      onChange={(e) => mudar(b.chave, { ativo: e.target.checked })}
                    />{" "}
                    Mostrar na página
                  </label>
                  {somenteLeitura ? null : (
                    <div className="banner-acoes">
                      <button
                        type="button"
                        className="botao botao-secundario"
                        onClick={() => mover(i, -1)}
                        disabled={i === 0}
                        aria-label={`Subir o banner ${i + 1}`}
                      >
                        Subir
                      </button>
                      <button
                        type="button"
                        className="botao botao-secundario"
                        onClick={() => mover(i, 1)}
                        disabled={i === itens.length - 1}
                        aria-label={`Descer o banner ${i + 1}`}
                      >
                        Descer
                      </button>
                      <button
                        type="button"
                        className="botao botao-secundario"
                        onClick={() => setItens((a) => a.filter((x) => x.chave !== b.chave))}
                        aria-label={`Remover o banner ${i + 1}`}
                      >
                        Remover
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {somenteLeitura ? null : cheio ? (
        <Aviso tipo="info">
          Limite de {limite} imagem(ns) suas atingido. Remova uma para adicionar outra.
        </Aviso>
      ) : (
        <div className="campo">
          <label htmlFor={`${idCampo}-arquivo`} className="rotulo-arquivo">
            Adicionar imagem de banner
          </label>
          <input
            id={`${idCampo}-arquivo`}
            type="file"
            accept={LIMITES.imagem.tiposPermitidos.join(",")}
            multiple
            disabled={subindo}
            onChange={aoEscolher}
            aria-describedby={`${idCampo}-ajuda-arq`}
          />
          <p id={`${idCampo}-ajuda-arq`} className="ajuda">
            JPEG, PNG ou WebP, até {maxMb} MB cada. Imagens grandes são reduzidas automaticamente.
          </p>
        </div>
      )}
      {subindo ? (
        <p className="ajuda" role="status">
          Enviando imagem...
        </p>
      ) : null}
      {mensagem ? (
        <p className="erro-campo" role="alert">
          {mensagem}
        </p>
      ) : null}

      {somenteLeitura ? null : (
        <BotaoEnviar
          enviando={enviando || subindo}
          rotulo="Salvar banners"
          rotuloEnviando={subindo ? "Enviando imagem..." : "Salvando..."}
        />
      )}
    </form>
  );
}

// ------------------------------------------------------------------------------------------ proposta do administrador

/** Aceitar (um toque) e Recusar (motivo obrigatório). */
export function RespostaBanner({ bannerId }: { bannerId: string }) {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario(
    acaoResponderBanner,
    validarRecusaBanner,
  );
  return (
    <div className="resposta-banner">
      <FormAcao
        acao={acaoResponderBanner}
        campos={{ bannerId, decisao: "aceitar" }}
        rotulo="Aceitar"
        rotuloEnviando="Aceitando..."
      />
      <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
        {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
        {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
        <input type="hidden" name="bannerId" value={bannerId} />
        <input type="hidden" name="decisao" value="recusar" />
        <CampoTextoLongo
          nome="motivo"
          rotulo="Motivo da recusa"
          valorInicial={estado.valores?.motivo}
          erro={erros.motivo}
          linhas={2}
        />
        <BotaoEnviar
          enviando={enviando}
          rotulo="Recusar"
          rotuloEnviando="Recusando..."
          secundario
        />
      </form>
    </div>
  );
}

export function AlternarBanner({ bannerId, ativo }: { bannerId: string; ativo: boolean }) {
  return (
    <FormAcao
      acao={acaoBannerAtivo}
      campos={{ bannerId, ativo: ativo ? "nao" : "sim" }}
      rotulo={ativo ? "Ocultar da página" : "Voltar a exibir"}
      rotuloEnviando="Salvando..."
      secundario
    />
  );
}

// ------------------------------------------------------------------------------------------ administrador

/** Administrador adiciona banner na empresa: imagem (adm-*), descrição, destino e motivo obrigatórios. */
export function FormBannerAdmin({
  perfilId,
  enviar = enviarImagemDeBanner,
}: {
  perfilId: string;
  enviar?: (
    arquivo: File,
    o: { perfilId: string; admin: boolean },
  ) => Promise<ResultadoEnvioBanner>;
}) {
  const idArq = useId();
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario(
    acaoAdicionarBannerAdmin,
    validarAdicionarBannerAdmin,
  );
  const [imagem, setImagem] = useState<{ caminho: string; url: string | null } | null>(null);
  const [subindo, setSubindo] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const maxMb = LIMITES.imagem.tamanhoMaxBytes / (1024 * 1024);

  async function aoEscolher(e: ChangeEvent<HTMLInputElement>) {
    const campo = e.currentTarget;
    const arquivo = campo.files?.[0];
    campo.value = "";
    if (!arquivo) return;
    setFalha(null);
    setSubindo(true);
    try {
      const r = await enviar(arquivo, { perfilId, admin: true });
      if (r.ok) setImagem({ caminho: r.caminho, url: r.url });
      else setFalha(r.mensagem);
    } finally {
      setSubindo(false);
    }
  }

  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <input type="hidden" name="perfilId" value={perfilId} />
      <input type="hidden" name="imagemPath" value={imagem?.caminho ?? ""} />
      <div className="campo">
        <label htmlFor={idArq} className="rotulo-arquivo">
          {imagem ? "Trocar a imagem" : "Escolher a imagem do banner"}
        </label>
        <input
          id={idArq}
          type="file"
          accept={LIMITES.imagem.tiposPermitidos.join(",")}
          disabled={subindo}
          onChange={aoEscolher}
          aria-invalid={erros.imagemPath ? true : undefined}
          aria-describedby={`${idArq}-ajuda`}
        />
        <p id={`${idArq}-ajuda`} className="ajuda">
          JPEG, PNG ou WebP, até {maxMb} MB.
        </p>
        {erros.imagemPath ? <p className="erro-campo">{erros.imagemPath}</p> : null}
        {subindo ? (
          <p className="ajuda" role="status">
            Enviando imagem...
          </p>
        ) : null}
        {falha ? (
          <p className="erro-campo" role="alert">
            {falha}
          </p>
        ) : null}
        {imagem?.url ? (
          <img
            className="banner-previa-admin"
            src={imagem.url}
            alt="Imagem escolhida para o banner"
          />
        ) : null}
      </div>
      <Campo
        nome="textoAlternativo"
        rotulo="Descrição da imagem"
        valorInicial={estado.valores?.textoAlternativo}
        erro={erros.textoAlternativo}
        ajuda="Obrigatória. Descreva o que aparece, para quem não enxerga a imagem."
      />
      <CampoSelect
        nome="destinoSecao"
        rotulo="Ao tocar, levar para"
        opcional
        vazio="Sem destino"
        opcoes={OPCOES_DESTINO}
        valorInicial={estado.valores?.destinoSecao}
        erro={erros.destinoSecao}
      />
      <CampoTextoLongo
        nome="motivo"
        rotulo="Motivo (fica na auditoria)"
        valorInicial={estado.valores?.motivo}
        erro={erros.motivo}
        linhas={2}
      />
      <BotaoEnviar
        enviando={enviando || subindo}
        rotulo="Enviar ao responsável"
        rotuloEnviando={subindo ? "Enviando imagem..." : "Enviando..."}
      />
    </form>
  );
}

export function FormRemoverBannerAdmin({ bannerId }: { bannerId: string }) {
  const { estado, action, enviando, erros, registrarForm, aoEnviar } = useFormulario(
    acaoRemoverBannerAdmin,
    validarRemoverBannerAdmin,
  );
  return (
    <form ref={registrarForm} action={action} onSubmit={aoEnviar} noValidate>
      {estado.erro ? <Aviso tipo="erro">{estado.erro}</Aviso> : null}
      {estado.sucesso ? <Aviso tipo="sucesso">{estado.sucesso}</Aviso> : null}
      <input type="hidden" name="bannerId" value={bannerId} />
      <CampoTextoLongo
        nome="motivo"
        rotulo="Motivo para retirar este banner"
        valorInicial={estado.valores?.motivo}
        erro={erros.motivo}
        linhas={2}
      />
      <BotaoEnviar
        enviando={enviando}
        rotulo="Retirar banner"
        rotuloEnviando="Retirando..."
        perigo
      />
    </form>
  );
}
