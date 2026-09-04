import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { FeedbackProvider } from "./components/Feedback";
import { ConfiguracaoProvider } from "./components/ConfiguracaoContext";

// Carregamento sob demanda das páginas: cada rota vira um chunk separado,
// mantendo o pacote inicial (dashboard) pequeno e trazendo bibliotecas
// pesadas (ex.: Recharts) só quando a página que as usa é aberta.
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const VendasPage = lazy(() => import("./pages/VendasPage"));
const HistoricoVendasPage = lazy(() => import("./pages/HistoricoVendasPage"));
const ProdutosPage = lazy(() => import("./pages/ProdutosPage"));
const MovimentacoesPage = lazy(() => import("./pages/MovimentacoesPage"));
const FornecedoresPage = lazy(() => import("./pages/FornecedoresPage"));
const ClientesPage = lazy(() => import("./pages/ClientesPage"));
const ClienteFichaPage = lazy(() => import("./pages/ClienteFichaPage"));
const CategoriasPage = lazy(() => import("./pages/CategoriasPage"));
const ContasReceberPage = lazy(() => import("./pages/ContasReceberPage"));
const RelatoriosPage = lazy(() => import("./pages/RelatoriosPage"));
const FormaPagamentoPage = lazy(() => import("./pages/relatorios/FormaPagamentoPage"));
const CurvaAbcPage = lazy(() => import("./pages/relatorios/CurvaAbcPage"));
const SemGiroPage = lazy(() => import("./pages/relatorios/SemGiroPage"));
const KardexPage = lazy(() => import("./pages/relatorios/KardexPage"));
const RankingClientesPage = lazy(() => import("./pages/relatorios/RankingClientesPage"));
const ComprasFornecedorPage = lazy(() => import("./pages/relatorios/ComprasFornecedorPage"));
const VendasDiaHorarioPage = lazy(() => import("./pages/relatorios/VendasDiaHorarioPage"));
const DescontosPage = lazy(() => import("./pages/relatorios/DescontosPage"));
const VendasCategoriaPage = lazy(() => import("./pages/relatorios/VendasCategoriaPage"));
const PerdasPage = lazy(() => import("./pages/relatorios/PerdasPage"));
const GiroPage = lazy(() => import("./pages/relatorios/GiroPage"));
const ClientesInativosPage = lazy(() => import("./pages/relatorios/ClientesInativosPage"));
const ConfiguracoesPage = lazy(() => import("./pages/ConfiguracoesPage"));

function Carregando() {
  return <p className="vazio">Carregando...</p>;
}

function App() {
  return (
    <FeedbackProvider>
      <ConfiguracaoProvider>
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route
            path="dashboard"
            element={
              <Suspense fallback={<Carregando />}>
                <DashboardPage />
              </Suspense>
            }
          />
          <Route
            path="vendas"
            element={
              <Suspense fallback={<Carregando />}>
                <VendasPage />
              </Suspense>
            }
          />
          <Route
            path="vendas/historico"
            element={
              <Suspense fallback={<Carregando />}>
                <HistoricoVendasPage />
              </Suspense>
            }
          />
          <Route
            path="produtos"
            element={
              <Suspense fallback={<Carregando />}>
                <ProdutosPage />
              </Suspense>
            }
          />
          <Route
            path="movimentacoes"
            element={
              <Suspense fallback={<Carregando />}>
                <MovimentacoesPage />
              </Suspense>
            }
          />
          <Route
            path="fornecedores"
            element={
              <Suspense fallback={<Carregando />}>
                <FornecedoresPage />
              </Suspense>
            }
          />
          <Route
            path="clientes"
            element={
              <Suspense fallback={<Carregando />}>
                <ClientesPage />
              </Suspense>
            }
          />
          <Route
            path="clientes/:id"
            element={
              <Suspense fallback={<Carregando />}>
                <ClienteFichaPage />
              </Suspense>
            }
          />
          <Route
            path="categorias"
            element={
              <Suspense fallback={<Carregando />}>
                <CategoriasPage />
              </Suspense>
            }
          />
          <Route
            path="contas-a-receber"
            element={
              <Suspense fallback={<Carregando />}>
                <ContasReceberPage />
              </Suspense>
            }
          />
          <Route
            path="relatorios"
            element={
              <Suspense fallback={<Carregando />}>
                <RelatoriosPage />
              </Suspense>
            }
          />
          <Route
            path="relatorios/forma-pagamento"
            element={
              <Suspense fallback={<Carregando />}>
                <FormaPagamentoPage />
              </Suspense>
            }
          />
          <Route
            path="relatorios/curva-abc"
            element={
              <Suspense fallback={<Carregando />}>
                <CurvaAbcPage />
              </Suspense>
            }
          />
          <Route
            path="relatorios/sem-giro"
            element={
              <Suspense fallback={<Carregando />}>
                <SemGiroPage />
              </Suspense>
            }
          />
          <Route
            path="relatorios/kardex"
            element={
              <Suspense fallback={<Carregando />}>
                <KardexPage />
              </Suspense>
            }
          />
          <Route
            path="relatorios/ranking-clientes"
            element={
              <Suspense fallback={<Carregando />}>
                <RankingClientesPage />
              </Suspense>
            }
          />
          <Route
            path="relatorios/compras-fornecedor"
            element={
              <Suspense fallback={<Carregando />}>
                <ComprasFornecedorPage />
              </Suspense>
            }
          />
          <Route
            path="relatorios/vendas-dia-horario"
            element={
              <Suspense fallback={<Carregando />}>
                <VendasDiaHorarioPage />
              </Suspense>
            }
          />
          <Route
            path="relatorios/descontos"
            element={
              <Suspense fallback={<Carregando />}>
                <DescontosPage />
              </Suspense>
            }
          />
          <Route
            path="relatorios/vendas-categoria"
            element={
              <Suspense fallback={<Carregando />}>
                <VendasCategoriaPage />
              </Suspense>
            }
          />
          <Route
            path="relatorios/perdas"
            element={
              <Suspense fallback={<Carregando />}>
                <PerdasPage />
              </Suspense>
            }
          />
          <Route
            path="relatorios/giro"
            element={
              <Suspense fallback={<Carregando />}>
                <GiroPage />
              </Suspense>
            }
          />
          <Route
            path="relatorios/clientes-inativos"
            element={
              <Suspense fallback={<Carregando />}>
                <ClientesInativosPage />
              </Suspense>
            }
          />
          <Route
            path="configuracoes"
            element={
              <Suspense fallback={<Carregando />}>
                <ConfiguracoesPage />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
      </BrowserRouter>
      </ConfiguracaoProvider>
    </FeedbackProvider>
  );
}

export default App;
