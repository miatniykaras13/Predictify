import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { AppRoutes } from './app/routes';
import './app/styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Не найден корневой элемент приложения.');
}

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </StrictMode>,
);
