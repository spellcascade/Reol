import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTrackAndMigrateSongRequest1766657458169
  implements MigrationInterface
{
  name = 'AddTrackAndMigrateSongRequest1766657458169';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('PRAGMA foreign_keys = ON;');

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
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_track_spotifyId_unique" ON "track" ("spotifyId")'
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_track_isrc_unique" ON "track" ("isrc")'
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "song_request_new" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "url" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "guildId" TEXT NOT NULL,
        "requestedBy" TEXT NOT NULL,
        "requestedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        "trackId" integer,
        CONSTRAINT "FK_song_request_track" FOREIGN KEY ("trackId") REFERENCES "track" ("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      INSERT OR IGNORE INTO "track" ("spotifyId", "createdAt")
      SELECT
        "spotifyId" AS "spotifyId",
        COALESCE("requestedAt", CURRENT_TIMESTAMP) AS "createdAt"
      FROM "song_request"
      WHERE "spotifyId" IS NOT NULL AND "spotifyId" != ''
    `);

    await queryRunner.query(`
      INSERT INTO "song_request_new" ("id", "url", "title", "guildId", "requestedBy", "requestedAt", "trackId")
      SELECT
        sr."id",
        sr."url",
        sr."title",
        sr."guildId",
        sr."requestedBy",
        sr."requestedAt",
        (
          SELECT t."id"
          FROM "track" t
          WHERE t."spotifyId" = sr."spotifyId"
          LIMIT 1
        ) AS "trackId"
      FROM "song_request" sr
    `);

    await queryRunner.query('DROP TABLE "song_request"');
    await queryRunner.query(
      'ALTER TABLE "song_request_new" RENAME TO "song_request"'
    );

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_song_request_trackId" ON "song_request" ("trackId")'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('PRAGMA foreign_keys = ON;');

    await queryRunner.query(`
      CREATE TABLE "song_request_old" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "url" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "name" TEXT NOT NULL DEFAULT '',
        "artist" TEXT NOT NULL DEFAULT '',
        "requestedBy" TEXT NOT NULL,
        "guildId" TEXT NOT NULL,
        "spotifyId" TEXT,
        "requestedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      )
    `);

    await queryRunner.query(`
      INSERT INTO "song_request_old" ("id","url","title","name","artist","requestedBy","guildId","spotifyId","requestedAt")
      SELECT
        sr."id",
        sr."url",
        sr."title",
        '' AS "name",
        '' AS "artist",
        sr."requestedBy",
        sr."guildId",
        t."spotifyId" AS "spotifyId",
        sr."requestedAt"
      FROM "song_request" sr
      LEFT JOIN "track" t ON t."id" = sr."trackId"
    `);

    await queryRunner.query('DROP TABLE "song_request"');
    await queryRunner.query(
      'ALTER TABLE "song_request_old" RENAME TO "song_request"'
    );

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_song_request_trackId"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_track_isrc_unique"');
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_track_spotifyId_unique"'
    );
    await queryRunner.query('DROP TABLE IF EXISTS "track"');
  }
}
