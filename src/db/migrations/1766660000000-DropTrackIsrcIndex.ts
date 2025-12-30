import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropTrackIsrcIndex1766660000000 implements MigrationInterface {
  name = 'DropTrackIsrcIndex1767111043205';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_track_isrc_unique"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_track_isrc_unique" ON "track" ("isrc")`
    );
  }
}
