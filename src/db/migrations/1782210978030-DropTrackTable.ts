import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropTrackTable1782210978030 implements MigrationInterface {
  name = 'DropTrackTable1782210978030';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('PRAGMA foreign_keys = OFF;');

    const songRequestColumns: Array<{ name: string }> = await queryRunner.query(
      `PRAGMA table_info("song_request")`,
    );
    const hasTrackId = songRequestColumns.some(
      (column) => column.name === 'trackId',
    );

    if (hasTrackId) {
      await queryRunner.query(`
        CREATE TABLE "song_request_new" (
          "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          "url" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "guildId" TEXT NOT NULL,
          "requestedBy" TEXT NOT NULL,
          "requestedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
          "normalizedTitle" TEXT NOT NULL DEFAULT ''
        )
      `);

      await queryRunner.query(`
        INSERT INTO "song_request_new" (
          "id",
          "url",
          "title",
          "guildId",
          "requestedBy",
          "requestedAt",
          "normalizedTitle"
        )
        SELECT
          "id",
          "url",
          "title",
          "guildId",
          "requestedBy",
          "requestedAt",
          "normalizedTitle"
        FROM "song_request"
      `);

      await queryRunner.query(`DROP TABLE "song_request"`);
      await queryRunner.query(
        `ALTER TABLE "song_request_new" RENAME TO "song_request"`,
      );
    }

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_song_request_trackId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_track_isrc_unique"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_track_spotifyId_unique"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "track"`);

    await queryRunner.query('PRAGMA foreign_keys = ON;');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('PRAGMA foreign_keys = OFF;');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "track" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "name" TEXT NOT NULL DEFAULT '',
        "artist" TEXT NOT NULL DEFAULT '',
        "spotifyId" TEXT,
        "isrc" TEXT,
        "createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_track_spotifyId_unique" ON "track" ("spotifyId")`,
    );

    const songRequestColumns: Array<{ name: string }> = await queryRunner.query(
      `PRAGMA table_info("song_request")`,
    );
    const hasTrackId = songRequestColumns.some(
      (column) => column.name === 'trackId',
    );

    if (!hasTrackId) {
      await queryRunner.query(`
        CREATE TABLE "song_request_old" (
          "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          "url" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "guildId" TEXT NOT NULL,
          "requestedBy" TEXT NOT NULL,
          "requestedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
          "trackId" integer,
          "normalizedTitle" TEXT NOT NULL DEFAULT '',
          CONSTRAINT "FK_song_request_track" FOREIGN KEY ("trackId") REFERENCES "track" ("id") ON DELETE SET NULL
        )
      `);

      await queryRunner.query(`
        INSERT INTO "song_request_old" (
          "id",
          "url",
          "title",
          "guildId",
          "requestedBy",
          "requestedAt",
          "trackId",
          "normalizedTitle"
        )
        SELECT
          "id",
          "url",
          "title",
          "guildId",
          "requestedBy",
          "requestedAt",
          NULL,
          "normalizedTitle"
        FROM "song_request"
      `);

      await queryRunner.query(`DROP TABLE "song_request"`);
      await queryRunner.query(
        `ALTER TABLE "song_request_old" RENAME TO "song_request"`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_song_request_trackId" ON "song_request" ("trackId")`,
      );
    }

    await queryRunner.query('PRAGMA foreign_keys = ON;');
  }
}
