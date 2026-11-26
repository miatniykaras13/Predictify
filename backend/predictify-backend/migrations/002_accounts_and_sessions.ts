import type { MigrationBuilder } from 'node-pg-migrate';

const users = { schema: 'app', name: 'users' };
const sessions = { schema: 'app', name: 'sessions' };

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(users, {
    id: {
      type: 'bigint',
      sequenceGenerated: { precedence: 'ALWAYS' },
      primaryKey: true,
    },
    email: { type: 'varchar(254)', notNull: true },
    public_name: { type: 'varchar(80)', notNull: true },
    password_hash: { type: 'text', notNull: true },
    role: { type: 'text', notNull: true, default: 'user' },
    avatar_key: { type: 'varchar(255)' },
  });
  pgm.addConstraint(users, 'users_email_unique', { unique: 'email' });
  pgm.addConstraint(users, 'users_email_normalized', {
    check: 'email = lower(btrim(email))',
  });
  pgm.addConstraint(users, 'users_role_allowed', {
    check: "role IN ('user', 'moderator', 'admin')",
  });

  pgm.createTable(sessions, {
    id: { type: 'uuid', primaryKey: true },
    user_id: {
      type: 'bigint',
      notNull: true,
      references: users,
      onDelete: 'CASCADE',
    },
    refresh_token_hash: { type: 'text', notNull: true, unique: true },
    expires_at: { type: 'timestamptz', notNull: true },
    revoked_at: { type: 'timestamptz' },
  });
  pgm.createIndex(sessions, 'user_id');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable(sessions);
  pgm.dropTable(users);
}
