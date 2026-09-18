import axios from "axios";

// Quando VITE_API_URL não é definida (ou é vazia), usa caminho relativo: a
// API é servida na mesma origem do frontend. É o caso do modo "servidor
// único", onde o backend também entrega o build do frontend numa porta só.
const baseURL = import.meta.env.VITE_API_URL || "";

export const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});
