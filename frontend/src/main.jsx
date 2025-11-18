import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import { AuthProvider } from './AuthContext';
import Root from './Root';

import { NotificationProvider } from './NotificationContext';
import Notifications from './Notifications';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <Notifications />
          <Root />
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  </StrictMode>,
);
