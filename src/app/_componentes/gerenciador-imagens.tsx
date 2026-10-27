"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { LIMITES, type TipoImagem } from "@/shared/config/limites";
import { gerarCaminhoImagem, validarImagem, type PastaImagem } from "@/shared/conteudo/imagens";
import { comprimirImagem } from "../_lib/comprimir-imagem";
import { enviarImagemAoStorage, type EnviarImagem } from "../_lib/upload-imagem";

export type ImagemDoCampo = { caminho: string; url: string | null };

type Props = {
  /** Nome do campo escondido que leva os caminhos ao formulário (um por imagem). */
  nome: string;
  rotulo: string;
  pasta: PastaImagem;
  /** Id do perfil ou item: a pasta onde o banco permite gravar. */
  donoId: string;
  limite: number;
  inicial: readonly ImagemDoCampo[];
  ajuda?: string;
  erro?: string;
  onOcupado?: (ocupado: boolean) => void;
  /** Injetáveis para teste. */
  enviar?: EnviarImagem;
  comprimir?: (arquivo: Blob) => Promise<Blob>;
};

const MSG_FALHA_ENVIO = "Não foi possível enviar a imagem. Tente novamente.";

/**
 * Imagens de um campo (principal, banners, fotos): escolhe, valida (2 MB; JPEG, PNG ou WebP), comprime no
 * navegador, envia direto ao Storage e guarda o caminho em campo escondido. A URL de exibição das imagens
 * já gravadas vem do servidor (assinada); a das recém-enviadas é local, nunca do Storage.
 */
export function GerenciadorImagens({
  nome,
  rotulo,
  pasta,
  donoId,
  limite,
  inicial,
  ajuda,
  erro,
  onOcupado,
  enviar = enviarImagemAoStorage,
  comprimir = comprimirImagem,
}: Props) {
  const id = useId();
  const [itens, setItens] = useState<ImagemDoCampo[]>([...inicial]);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  // O pai pode passar uma função nova a cada render: guardamos a última e avisamos só quando muda `ocupado`.
  const avisar = useRef(onOcupado);
  useEffect(() => {
    avisar.current = onOcupado;
  });
  useEffect(() => avisar.current?.(ocupado), [ocupado]);

  async function aoEscolher(e: ChangeEvent<HTMLInputElement>) {
    const campo = e.currentTarget;
    const arquivos = Array.from(campo.files ?? []);
    campo.value = "";
    if (arquivos.length === 0) return;
    setMensagem(null);
    setOcupado(true);
    let restante = limite - itens.length;
    const falhas: string[] = [];
    try {
      for (const arquivo of arquivos) {
        if (restante <= 0) {
          falhas.push(`Limite de ${limite} imagem(ns) neste campo.`);
          break;
        }
        // Só o tipo aqui: o tamanho original (foto de celular) é conferido DEPOIS de comprimir.
        const tipoOk = validarImagem({ tipoMime: arquivo.type, tamanhoBytes: 1 });
        if (!tipoOk.ok) {
          falhas.push(`${arquivo.name}: ${tipoOk.mensagem}`);
          continue;
        }
        const pronto = await comprimir(arquivo);
        const final = validarImagem({ tipoMime: pronto.type, tamanhoBytes: pronto.size });
        if (!final.ok) {
          falhas.push(`${arquivo.name}: ${final.mensagem}`);
          continue;
        }
        let caminho: string;
        try {
          caminho = gerarCaminhoImagem(pasta, donoId, pronto.type as TipoImagem);
        } catch {
          falhas.push(`${arquivo.name}: ${MSG_FALHA_ENVIO}`);
          continue;
        }
        const gravou = await enviar(caminho, pronto, pronto.type);
        if (!gravou) {
          falhas.push(`${arquivo.name}: ${MSG_FALHA_ENVIO}`);
          continue;
        }
        const url = typeof URL.createObjectURL === "function" ? URL.createObjectURL(pronto) : null;
        setItens((atual) => [...atual, { caminho, url }]);
        restante -= 1;
      }
    } finally {
      setOcupado(false);
    }
    if (falhas.length > 0) setMensagem(falhas.join(" "));
  }

  const cheio = itens.length >= limite;
  const idMsg = `${id}-msg`;
  const idAjuda = `${id}-ajuda`;
  const maxMb = LIMITES.imagem.tamanhoMaxBytes / (1024 * 1024);

  return (
    <fieldset className="campo grupo-imagens" aria-describedby={ajuda ? idAjuda : undefined}>
      <legend>{rotulo}</legend>
      {ajuda ? (
        <p id={idAjuda} className="ajuda">
          {ajuda}
        </p>
      ) : null}

      {itens.length === 0 && limite === 1 ? <input type="hidden" name={nome} value="" /> : null}
      <ul className="lista-imagens">
        {itens.map((it, i) => (
          <li key={it.caminho}>
            <input type="hidden" name={nome} value={it.caminho} />
            {it.url ? (
              // URL assinada do Storage ou local: next/image não otimiza URL que muda a cada visita.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.url} alt={`${rotulo}, imagem ${i + 1}`} loading="lazy" />
            ) : (
              <span className="imagem-indisponivel">Imagem sem prévia</span>
            )}
            <button
              type="button"
              className="botao-texto"
              aria-label={`Remover ${rotulo.toLowerCase()}, imagem ${i + 1}`}
              onClick={() => setItens((atual) => atual.filter((x) => x.caminho !== it.caminho))}
            >
              Remover
            </button>
          </li>
        ))}
      </ul>

      {cheio ? (
        <p className="ajuda">Limite de {limite} atingido. Remova uma imagem para trocar.</p>
      ) : (
        <>
          <label htmlFor={id} className="rotulo-arquivo">
            {limite === 1 ? "Escolher imagem" : "Adicionar imagens"}
          </label>
          <input
            id={id}
            type="file"
            accept={LIMITES.imagem.tiposPermitidos.join(",")}
            multiple={limite > 1}
            disabled={ocupado}
            onChange={aoEscolher}
            aria-describedby={mensagem ? idMsg : undefined}
          />
          <p className="ajuda">
            JPEG, PNG ou WebP, até {maxMb} MB cada. Imagens grandes são reduzidas automaticamente.
          </p>
        </>
      )}

      {ocupado ? (
        <p className="ajuda" role="status">
          Enviando imagem...
        </p>
      ) : null}
      {mensagem ? (
        <p id={idMsg} className="erro-campo" role="alert">
          {mensagem}
        </p>
      ) : null}
      {erro ? <p className="erro-campo">{erro}</p> : null}
    </fieldset>
  );
}
