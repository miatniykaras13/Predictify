# Predictify Backend — общая основа

Каркас Node.js API и PostgreSQL для общей подготовки проекта Predictify.
Технологический стек: Node.js + TypeScript + Fastify + pg + node-pg-migrate.

## Требования

- Node.js 24.7 или новее в ветке 24.x
- Docker / Docker Compose
- npm

## Локальный запуск backend

Чтобы запустить backend на хосте, настройте корневой `.env` по инструкции совместного запуска, затем поднимите PostgreSQL из корня репозитория. [Инструкция в корневом README](../../README.md#запуск-через-docker-compose)

```bash
docker compose up -d --wait postgres
```

Затем из каталога backend создайте локальный `.env`, установите зависимости и укажите в `DATABASE_URL` пароль `POSTGRES_PASSWORD` и порт `POSTGRES_PORT` из корневого `.env`. Задайте `AUTH_ACCESS_TOKEN_SECRET` и, если нужно, `AUTH_APP_ORIGIN` по инструкции запуска Compose.

```bash
cp .env.example .env
npm ci
```

После настройки подключения примените миграции и запустите API.

```bash
npm run migrate:up
npm run dev
```

Проверки:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/ready
```

`/health` проверяет, что процесс API запущен. `/ready` дополнительно проверяет соединение с PostgreSQL и возвращает HTTP 503 при недоступной БД.

## Тесты аккаунтов и сессий

`npm test` запускает тесты без подключения к PostgreSQL. Для `npm run test:integration` примените миграции к отдельной тестовой базе и передайте её строку подключения через `TEST_DATABASE_URL`. Интеграционные тесты создают и удаляют тестовые аккаунты.

## Миграции

Создание:

```bash
npm run migrate:create -- add_<short_name>
```

Применение:

```bash
npm run migrate:up
```

Откат последней миграции:

```bash
npm run migrate:down
```

Полный пересоздающий сценарий локальной БД:

```bash
npm run db:reset
```

Для CI/нового окружения: создать пустую PostgreSQL БД, задать `DATABASE_URL`, затем выполнить `npm run migrate:up`.

## Правила схемы

1. Каждое изменение PostgreSQL оформляется отдельной версионируемой миграцией.
2. Уже применённые миграции не редактируются; исправление делается новой миграцией.
3. Общая миграция содержит только инфраструктурные объекты, необходимые нескольким модулям.
4. Таблицы функциональных модулей добавляют владельцы соответствующих модулей.
5. Изменения общих контрактов/таблиц согласуются с владельцами смежных зон до merge.
6. Миграция должна быть повторяемо применима на чистой БД и иметь проверяемый rollback, если rollback технически допустим.
7. Для ограничений целостности предпочтительны ограничения PostgreSQL (`NOT NULL`, `UNIQUE`, `CHECK`, FK), а не только проверки в API.
8. Секреты и реальные `DATABASE_URL` не коммитятся.

## Gitflow и PR

Ветка:

```text
feature/<номер-issue>-<краткое-название>
```

Создаётся от `develop`. Коммиты — Conventional Commits, например:

```text
feat: add api readiness endpoint
docs: document database migrations
chore: add postgres compose service
```

PR направляется в `develop` и содержит:

- `Closes #<номер-issue>`;
- краткое описание результата;
- выполненные проверки;
- отметку о проверке миграций с чистой БД;
- ревью другого участника.

## Проверка создания БД с нуля

Из корня репозитория запустите отдельный Compose-проект со свободными локальными портами и пустыми томами.

```bash
docker compose -p predictify-check up -d --build --wait
```

Через адрес frontend запрос `/api/ready` должен вернуть `200` и `{"status":"ready","database":"up"}`. После проверки удалите контейнеры и тома тестового проекта командой `docker compose -p predictify-check down -v`.
