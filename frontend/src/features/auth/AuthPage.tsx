import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { ApiError, apiRequest } from '../../shared/api/apiRequest';
import { Button, LoadingState, TextField } from '../../shared/ui';
import { session } from './session';
import { useSessionStatus } from './useSessionStatus';

function formError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) return 'Эта почта уже зарегистрирована.';
    if (error.status === 401) return 'Проверьте почту и пароль.';
    if (error.status === 400) return 'Проверьте данные формы.';
    if (error.kind === 'network') return error.message;
  }
  return 'Не удалось отправить форму. Повторите попытку.';
}

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const registration = mode === 'register';
  const status = useSessionStatus();
  const location = useLocation();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  if (status === 'checking') return <LoadingState title="Проверяем сессию…" />;
  if (status === 'signed-in' || status === 'signing-out') {
    return <Navigate to="/events" replace />;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const data = new FormData(event.currentTarget);
    const email = String(data.get('email')).trim();
    const password = String(data.get('password'));
    const length = Array.from(password).length;
    if ((registration && length < 15) || length > 128) {
      setPasswordError(
        registration
          ? 'Введите пароль от 15 до 128 символов.'
          : 'Пароль должен содержать не более 128 символов.',
      );
      return;
    }

    setError('');
    setPasswordError('');
    setPending(true);
    try {
      if (registration) {
        const publicName = String(data.get('publicName')).trim();
        if (!publicName || Array.from(publicName).length > 80) {
          setError('Введите публичное имя длиной от 1 до 80 символов.');
          return;
        }
        await apiRequest('/auth/register', {
          method: 'POST',
          json: { email, password, publicName },
        });
        void navigate('/login', { replace: true, state: { registered: true } });
      } else {
        await session.signIn(email, password);
      }
    } catch (error) {
      setError(formError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="auth-panel" aria-labelledby="auth-title">
      <h1 id="auth-title">{registration ? 'Регистрация' : 'Вход'}</h1>
      {!registration && location.state?.registered && (
        <p role="status">Аккаунт создан. Войдите с почтой и паролем.</p>
      )}
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        {registration && (
          <TextField
            label="Публичное имя"
            name="publicName"
            autoComplete="nickname"
            maxLength={160}
            required
          />
        )}
        <TextField
          label="Электронная почта"
          type="email"
          name="email"
          autoComplete="username"
          maxLength={254}
          required
        />
        <TextField
          label="Пароль"
          type="password"
          name="password"
          autoComplete={registration ? 'new-password' : 'current-password'}
          error={passwordError}
          onChange={() => setPasswordError('')}
          maxLength={256}
          aria-describedby={registration ? 'password-length' : undefined}
          required
        />
        {registration && <p id="password-length">От 15 до 128 символов.</p>}
        {error && (
          <p role="alert" className="field__error">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? 'Отправляем…' : registration ? 'Создать аккаунт' : 'Войти'}
        </Button>
      </form>
      {registration ? (
        <Link to="/login">Уже есть аккаунт? Войти</Link>
      ) : (
        <Link to="/register">Создать аккаунт</Link>
      )}
    </section>
  );
}
