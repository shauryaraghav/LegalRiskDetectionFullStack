import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/ui";
import AuthPage from "./pages/Auth";
import Compare from "./pages/Compare";
import ContractPage from "./pages/ContractDetail";
import Contracts from "./pages/Contracts";
import Model from "./pages/Model";
import NewContract from "./pages/NewContract";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route element={<Layout />}>
        <Route index element={<Contracts />} />
        <Route path="new" element={<NewContract />} />
        <Route path="contracts/:id" element={<ContractPage />} />
        <Route path="compare" element={<Compare />} />
        <Route path="model" element={<Model />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
