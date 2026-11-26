import { lazy, Suspense } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router';
import { AuthPage } from '../features/auth/AuthPage';
import { EventsPage } from '../features/events/EventsPage';
import { LeaderboardPage } from '../features/leaderboard/LeaderboardPage';
import { LoadingState } from '../shared/ui';
import { AppLayout } from './AppLayout';

const UiDemo = import.meta.env.DEV
  ? lazy(() => import('../features/ui-demo/UiDemo'))
  : null;

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/events" replace />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="leaderboard" element={<LeaderboardPage />} />
        <Route path="login" element={<AuthPage key="login" mode="login" />} />
        <Route
          path="register"
          element={<AuthPage key="register" mode="register" />}
        />
        {UiDemo && (
          <Route
            path="dev/ui"
            element={
              <Suspense fallback={<LoadingState />}>
                <UiDemo />
              </Suspense>
            }
          />
        )}
        <Route
          path="*"
          element={
            <>
              <h1>Страница не найдена</h1>
              <Link to="/events">К событиям</Link>
            </>
          }
        />
      </Route>
    </Routes>
  );
}
