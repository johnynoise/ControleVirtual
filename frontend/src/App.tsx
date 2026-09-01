import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import CategoriasPage from "./pages/CategoriasPage";
import ProdutosPage from "./pages/ProdutosPage";
import MovimentacoesPage from "./pages/MovimentacoesPage";
import FornecedoresPage from "./pages/FornecedoresPage";
import VendasPage from "./pages/VendasPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/vendas" replace />} />
          <Route path="vendas" element={<VendasPage />} />
          <Route path="produtos" element={<ProdutosPage />} />
          <Route path="movimentacoes" element={<MovimentacoesPage />} />
          <Route path="fornecedores" element={<FornecedoresPage />} />
          <Route path="categorias" element={<CategoriasPage />} />
          <Route path="*" element={<Navigate to="/vendas" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
