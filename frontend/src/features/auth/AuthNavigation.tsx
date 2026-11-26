import { useEffect, useState } from 'react';
import { NavLink } from 'react-router';
import { Button } from '../../shared/ui';
import { session } from './session';
import { useSessionStatus } from './useSessionStatus';

export function AuthNavigation() {
  const status = useSessionStatus();
  const [logoutError, setLogoutError] = useState(false);

  useEffect(() => {
    void session.restore();
  }, []);

  if (status === 'checking')
    return <span role="status">Проверяем сессию…</span>;

  if (status === 'signed-in' || status === 'signing-out' || logoutError) {
    return (
      <>
        <Button
          variant="secondary"
          disabled={status === 'signing-out'}
          onClick={() => {
            setLogoutError(false);
            void session.signOut().catch(() => setLogoutError(true));
          }}
        >
          {status === 'signing-out' ? 'Выходим…' : 'Выйти'}
        </Button>
        {logoutError && (
          <span role="alert" className="field__error">
            Не удалось выйти. Повторите попытку.
          </span>
        )}
      </>
    );
  }

  return (
    <>
      <NavLink to="/login">Войти</NavLink>
      <NavLink to="/register">Регистрация</NavLink>
      {status === 'unavailable' && (
        <Button variant="secondary" onClick={() => void session.restore()}>
          Проверить сессию
        </Button>
      )}
    </>
  );
}
