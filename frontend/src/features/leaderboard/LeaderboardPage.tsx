import { EmptyState } from '../../shared/ui';

export function LeaderboardPage() {
  return (
    <>
      <h1>Рейтинг</h1>
      <EmptyState
        title="Рейтинг пока пуст"
        description="Здесь появятся результаты участников."
      />
    </>
  );
}
