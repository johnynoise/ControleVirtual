import { api } from "./api";
import type { Categoria, CategoriaCreate } from "../types";

export async function listarCategorias(): Promise<Categoria[]> {
  const { data } = await api.get<Categoria[]>("/categorias");
  return data;
}

export async function obterCategoria(id: number): Promise<Categoria> {
  const { data } = await api.get<Categoria>(`/categorias/${id}`);
  return data;
}

export async function criarCategoria(dados: CategoriaCreate): Promise<Categoria> {
  const { data } = await api.post<Categoria>("/categorias", dados);
  return data;
}

export async function atualizarCategoria(
  id: number,
  dados: CategoriaCreate
): Promise<Categoria> {
  const { data } = await api.put<Categoria>(`/categorias/${id}`, dados);
  return data;
}

export async function removerCategoria(id: number): Promise<void> {
  await api.delete(`/categorias/${id}`);
}
