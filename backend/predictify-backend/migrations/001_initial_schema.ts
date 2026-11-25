import type { MigrationBuilder } from "node-pg-migrate";

export const shorthands = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Shared infrastructure only. Functional module tables are added by module owners.
  pgm.createSchema("app", { ifNotExists: true });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropSchema("app", { ifExists: true, cascade: true });
}
