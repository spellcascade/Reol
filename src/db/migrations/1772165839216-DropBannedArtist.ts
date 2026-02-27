import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropBannedArtist1772165839216 implements MigrationInterface {
  name = 'DropBannedArtist1772165839216';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "banned_artist"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "banned_artist" (
        "spotifyId" text PRIMARY KEY NOT NULL
      )
    `);
  }
}
