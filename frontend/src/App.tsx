import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import CategoriasPage from "./pages/CategoriasPage";
import ProdutosPage from "./pages/ProdutosPage";
import MovimentacoesPage from "./pages/MovimentacoesPage";
import FornecedoresPage from "./pages/FornecedoresPage";
import VendasPage from "./pages/VendasPage";
import ClientesPage from "./pages/ClientesPage";
import ClienteFichaPage from "./pages/ClienteFichaPage";
import DashboardPage from "./pages/DashboardPage";
import RelatoriosPage from "./pages/RelatoriosPage";
import FormaPagamentoPage from "./pages/relatorios/FormaPagamentoPage";
import CurvaAbcPage from "./pages/relatorios/CurvaAbcPage";
import SemGiroPage from "./pages/relatorios/SemGiroPage";
import KardexPage from "./pages/relatorios/KardexPage";
import RankingClientesPage from "./pages/relatorios/RankingClientesPage";
import ComprasFornecedorPage from "./pages/relatorios/ComprasFornecedorPage";
import VendasDiaHorarioPage from "./pages/relatorios/VendasDiaHorarioPage";
import DescontosPage from "./pages/relatorios/DescontosPage";
import VendasCategoriaPage from "./pages/relatorios/VendasCategoriaPage";
import PerdasPage from "./pages/relatorios/PerdasPage";
import GiroPage from "./pages/relatorios/GiroPage";
import ClientesInativosPage from "./pages/relatorios/ClientesInativosPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="vendas" element={<VendasPage />} />
          <Route path="produtos" element={<ProdutosPage />} />
          <Route path="movimentacoes" element={<MovimentacoesPage />} />
          <Route path="fornecedores" element={<FornecedoresPage />} />
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="clientes/:id" element={<ClienteFichaPage />} />
          <Route path="categorias" element={<CategoriasPage />} />
          <Route path="relatorios" element={<RelatoriosPage />} />
          <Route path="relatorios/forma-pagamento" element={<FormaPagamentoPage />} />
          <Route path="relatorios/curva-abc" element={<CurvaAbcPage />} />
          <Route path="relatorios/sem-giro" element={<SemGiroPage />} />
          <Route path="relatorios/kardex" element={<KardexPage />} />
          <Route path="relatorios/ranking-clientes" element={<RankingClientesPage />} />
          <Route path="relatorios/compras-fornecedor" element={<ComprasFornecedorPage />} />
          <Route path="relatorios/vendas-dia-horario" element={<VendasDiaHorarioPage />} />
          <Route path="relatorios/descontos" element={<DescontosPage />} />
          <Route path="relatorios/vendas-categoria" element={<VendasCategoriaPage />} />
          <Route path="relatorios/perdas" element={<PerdasPage />} />
          <Route path="relatorios/giro" element={<GiroPage />} />
          <Route path="relatorios/clientes-inativos" element={<ClientesInativosPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
