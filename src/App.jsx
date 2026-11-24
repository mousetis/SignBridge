import { lazy, Suspense, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useHashRoute } from './hooks/useHashRoute.js';
import AppShell from './components/layout/AppShell.jsx';
import VirtualCursor from './components/esp32/VirtualCursor.jsx';
import { useSettings } from './context/SettingsContext.jsx';
import { useT } from './i18n/index.jsx';

// Mỗi trang tải riêng (Three.js / TensorFlow.js / MediaPipe chỉ nạp khi cần). Tên tệp: <Tên>Page.jsx
const FILES = import.meta.glob('./pages/*Page.jsx');
const ROUTES = {
  home: 'Home', welcome: 'Welcome', recognize: 'Recognize', converse: 'Converse', captions: 'Captions', text: 'TextToHand',
  learn: 'Learn', dict: 'Dictionary', train: 'Train', teacher: 'Teacher', settings: 'Settings',
};
const PAGES = {};
for (const [r, name] of Object.entries(ROUTES)) {
  const loader = FILES[`./pages/${name}Page.jsx`];
  if (loader) PAGES[r] = lazy(loader);
}
const BARE = new Set(['welcome']); // trang toàn màn hình, không có thanh điều hướng

export default function App() {
  const [route, go] = useHashRoute();
  const { settings } = useSettings();
  const { t } = useT();
  const key = PAGES[route] ? route : 'home';
  const Page = PAGES[key] || (() => null);

  // Lần đầu mở: dẫn tới hướng dẫn nhanh
  useEffect(() => {
    if (!settings.onboarded && route === 'home' && PAGES.welcome && !window.location.hash.replace('#', '')) go('welcome');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <AppShell route={key} go={go} bare={BARE.has(key)}>
        <Suspense
          fallback={
            <div className="flex items-center justify-center gap-4 py-24 text-xl font-bold text-muted" role="status">
              <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden /> {t('common.loading')}
            </div>
          }
        >
          <Page go={go} />
        </Suspense>
      </AppShell>
      <VirtualCursor />
    </>
  );
}
