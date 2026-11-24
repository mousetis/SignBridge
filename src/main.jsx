import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { SettingsProvider } from './context/SettingsContext.jsx';
import { I18nProvider } from './i18n/index.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { Esp32Provider } from './context/Esp32Context.jsx';
import { redirectToLocalhostIfNeeded } from './lib/ui/secureContext.js';
import { registerSW } from './lib/pwa.js';

// Mở bằng địa chỉ mạng (192.168.x.x) thì camera bị ẩn -> tự chuyển sang localhost nếu cùng máy.
function mount() {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <SettingsProvider>
        <I18nProvider>
          <ToastProvider>
            <Esp32Provider>
              <App />
            </Esp32Provider>
          </ToastProvider>
        </I18nProvider>
      </SettingsProvider>
    </StrictMode>,
  );
}

redirectToLocalhostIfNeeded().then((redirected) => { if (!redirected) mount(); }, mount);
registerSW();
