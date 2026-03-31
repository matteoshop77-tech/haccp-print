import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import HomePage     from "@/pages/HomePage";
import LabelsPage   from "@/pages/LabelsPage";
import LogPage      from "@/pages/LogPage";
import SettingsPage from "@/pages/SettingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/"         element={<HomePage />} />
          <Route path="/labels"   element={<LabelsPage />} />
          <Route path="/log"      element={<LogPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
