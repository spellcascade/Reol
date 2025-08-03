import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpotifyIdToSongRequest1691051234567
  implements MigrationInterface
{
  name = 'AddSpotifyIdToSongRequest1754203204070';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "song_request" ADD COLUMN "spotifyId" varchar DEFAULT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "song_request" DROP COLUMN "spotifyId"`
    );
  }
}
