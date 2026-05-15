import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./Layout";
import Compose from "./routes/Compose";
import MyStyle from "./routes/MyStyle";
import History from "./routes/History";
import Settings from "./routes/Settings";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Compose />} />
          <Route path="/style" element={<MyStyle />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
