import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Artist } from './pages/Artist';
import { Client } from './pages/Client';
import { Sessions } from './pages/Sessions';
import { TryOn } from './pages/TryOn';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="artist" element={<Artist />} />
          <Route path="client" element={<Client />} />
          <Route path="try-on" element={<TryOn />} />
          <Route path="sessions" element={<Sessions />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
