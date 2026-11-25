import { EmptyState } from '../../shared/ui';

export function EventsPage() {
  return (
    <>
      <h1>События</h1>
      <EmptyState
        title="Пока нет событий"
        description="Здесь появятся опубликованные события."
      />
    </>
  );
}
