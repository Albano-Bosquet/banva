import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Home } from './Home';
import { Editor } from './editor/Editor';
import { Presenter } from './Presenter';
import { SiteView } from './SiteView';
import './styles.css';

/** Rutas por hash: #/ inicio, #/d/<id> editor, #/v/<id> presentación. */
function useRoute() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const w = hash.match(/^#\/w\/([\w-]+)/);
  if (w) return { name: 'site' as const, id: w[1] };
  const v = hash.match(/^#\/v\/([\w-]+)/);
  if (v) return { name: 'present' as const, id: v[1] };
  const m = hash.match(/^#\/d\/([\w-]+)/);
  return m ? { name: 'editor' as const, id: m[1] } : { name: 'home' as const };
}

function App() {
  const route = useRoute();
  if (route.name === 'site') return <SiteView key={route.id} designId={route.id} />;
  if (route.name === 'present') return <Presenter key={route.id} designId={route.id} onExit={() => (location.hash = `#/d/${route.id}`)} />;
  if (route.name === 'editor') return <Editor key={route.id} designId={route.id} onHome={() => (location.hash = '#/')} />;
  return <Home onOpen={(id) => (location.hash = `#/d/${id}`)} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
