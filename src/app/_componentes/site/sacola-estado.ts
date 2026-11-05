"use client";

import { useSyncExternalStore } from "react";
import { adicionarNaSacola, alterarQuantidade, type ItemSacola } from "../../_lib/sacola";

/**
 * Estado da lista de interesse (D-023): só em memória, na aba aberta. Sem cookie, sem armazenamento local, sem
 * servidor (IM-029). Vários componentes de cliente (botões dos cartões, painel, formulário de contato) compartilham
 * este estado. `envio` conta quantas vezes o visitante pediu para levar a lista ao formulário de contato.
 */
type Estado = { perfilId: string; itens: ItemSacola[]; envio: number };

const VAZIO: Estado = { perfilId: "", itens: [], envio: 0 };
let estado: Estado = VAZIO;
const ouvintes = new Set<() => void>();

function definir(novo: Estado) {
  estado = novo;
  ouvintes.forEach((o) => o());
}

function assinar(o: () => void) {
  ouvintes.add(o);
  return () => ouvintes.delete(o);
}

export function useSacola(): Estado {
  return useSyncExternalStore(
    assinar,
    () => estado,
    () => VAZIO,
  );
}

/** Itens de OUTRO perfil nunca se misturam: ao trocar de perfil a lista recomeça. */
const doPerfil = (perfilId: string): Estado =>
  estado.perfilId === perfilId ? estado : { ...VAZIO, perfilId };

export const sacola = {
  adicionar(perfilId: string, item: { id: string; nome: string; escolhas?: string[] }) {
    const base = doPerfil(perfilId);
    definir({ ...base, itens: adicionarNaSacola(base.itens, item) });
  },
  alterar(indice: number, delta: number) {
    definir({ ...estado, itens: alterarQuantidade(estado.itens, indice, delta) });
  },
  limpar() {
    definir({ ...estado, itens: [] });
  },
  levarAoContato() {
    definir({ ...estado, envio: estado.envio + 1 });
  },
};
