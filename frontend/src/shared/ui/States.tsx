import type { ReactNode } from 'react';
import { Button } from './Button';

type StateProps = {
  title?: string;
  description?: string;
};

export function LoadingState({ title = 'Загрузка…', description }: StateProps) {
  return (
    <div className="state" role="status">
      <span className="spinner" aria-hidden="true" />
      <p className="state__title">{title}</p>
      {description && <p>{description}</p>}
    </div>
  );
}

export function ErrorState({
  title = 'Не удалось загрузить данные',
  description,
  onRetry,
}: StateProps & { onRetry?: () => void }) {
  return (
    <div className="state state--error">
      <div role="alert">
        <p className="state__title">{title}</p>
        {description && <p>{description}</p>}
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Повторить
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title = 'Пока ничего нет',
  description,
  action,
}: StateProps & {
  action?: ReactNode;
}) {
  return (
    <div className="state">
      <p className="state__title">{title}</p>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
