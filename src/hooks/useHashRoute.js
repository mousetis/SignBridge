import { useCallback, useEffect, useState } from 'react';

const read = () => window.location.hash.replace(/^#\/?/, '').split('?')[0] || 'home';

export function useHashRoute() {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const h = () => setRoute(read());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  const go = useCallback((r) => {
    window.location.hash = `#/${r}`;
  }, []);
  return [route, go];
}
