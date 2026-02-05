import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import IntranetLayout from "@/components/IntranetLayout";
import Dashboard from "@/pages/Dashboard";
import BoletaNotas from "@/pages/BoletaNotas";
import Horarios from "@/pages/Horarios";
import Asistencia from "@/pages/Asistencia";
import Comunicados from "@/pages/Comunicados";
import Calendario from "@/pages/Calendario";
import Perfil from "@/pages/Perfil";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<IntranetLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="boleta" element={<BoletaNotas />} />
            <Route path="horarios" element={<Horarios />} />
            <Route path="asistencia" element={<Asistencia />} />
            <Route path="comunicados" element={<Comunicados />} />
            <Route path="calendario" element={<Calendario />} />
            <Route path="perfil" element={<Perfil />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;
