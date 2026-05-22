/**
 * @file src/main.tsx
 * React 19 точка входа приложения BAZZAR.
 *
 * Слои провайдеров:
 *   QueryClientProvider  — кэш серверного состояния (TanStack Query)
 *   BrowserRouter        — маршрутизация на стороне клиента
 *   App                  — корневой компонент с маршрутами
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

/** Глобальный QueryClient с разумными дефолтами */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:          1000 * 60 * 3,  // данные свежие 3 мин
      gcTime:             1000 * 60 * 10, // кэш живёт 10 мин
      retry:              1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (err) => console.error('[mutation error]', err),
    },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('#root element not found');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
