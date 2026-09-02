import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { api } from "../services/api";

export default function Layout() {
  const [apiStatus, setApiStatus] = useState<string>("verificando...");

  useEffect(() => {
    api
      .get("/health")
      .then((res) => setApiStatus(res.data.status ?? "ok"))
      .catch(() => setApiStatus("offline"));
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">ControleVirtual</div>
        <nav className="nav">
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/vendas">Vendas</NavLink>
          <NavLink to="/produtos">Produtos</NavLink>
          <NavLink to="/movimentacoes">Movimentações</NavLink>
          <NavLink to="/fornecedores">Fornecedores</NavLink>
          <NavLink to="/clientes">Clientes</NavLink>
          <NavLink to="/categorias">Categorias</NavLink>
        </nav>
        <span className={`api-badge ${apiStatus === "ok" ? "ok" : "off"}`}>
          API: {apiStatus}
        </span>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
