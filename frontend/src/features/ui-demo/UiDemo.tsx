import { useState } from 'react';
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  Textarea,
  TextField,
} from '../../shared/ui';
import './ui-demo.css';

export default function UiDemo() {
  const [modalOpen, setModalOpen] = useState(false);
  const [retried, setRetried] = useState(false);

  return (
    <>
      <h1>Общие компоненты</h1>
      <section className="demo-section">
        <h2>Поля и кнопки</h2>
        <TextField label="Название" placeholder="Название события" />
        <Textarea label="Описание" rows={3} error="Укажите описание." />
        <div className="demo-actions">
          <Button onClick={() => setModalOpen(true)}>Открыть окно</Button>
          <Button variant="secondary" disabled>
            Недоступно
          </Button>
        </div>
        <Modal
          title="Подтверждение"
          open={modalOpen}
          onClose={() => setModalOpen(false)}
        >
          <p>Закройте окно кнопкой или клавишей Escape.</p>
        </Modal>
      </section>
      <section className="demo-section">
        <h2>Состояния</h2>
        <LoadingState />
        {retried ? (
          <EmptyState title="Новых результатов нет" />
        ) : (
          <ErrorState
            description="Попробуйте снова."
            onRetry={() => setRetried(true)}
          />
        )}
        <EmptyState title="Пока нет событий" />
      </section>
    </>
  );
}
