import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNormalizedSongRequestFields1774000000000
  implements MigrationInterface
{
  name = 'AddNormalizedSongRequestFields1774000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "song_request" ADD COLUMN "normalizedTitle" TEXT NOT NULL DEFAULT ''`,
    );

    const rows: Array<{ id: number; title: string }> = await queryRunner.query(
      `SELECT "id", "title" FROM "song_request"`,
    );

    for (const row of rows) {
      const normalized = normalizeYoutubeTitleForMigration(row.title);
      await queryRunner.query(
        `
          UPDATE "song_request"
          SET "normalizedTitle" = ?
          WHERE "id" = ?
        `,
        [normalized, row.id],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "song_request_old" (
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
      INSERT INTO "song_request_old" ("id", "url", "title", "guildId", "requestedBy", "requestedAt", "trackId")
      SELECT "id", "url", "title", "guildId", "requestedBy", "requestedAt", "trackId"
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
}

function normalizeYoutubeTitleForMigration(title: string): string {
  const prepared = title
    .normalize('NFKC')
    .replace(/\s+[–—−]\s+/g, ' - ')
    .replace(/\s+-\s+/g, ' - ')
    .replace(/^\s*\d+\.\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();

  const pipeIndex = prepared.indexOf('|');
  const titleWithoutPipe =
    pipeIndex === -1 ? prepared : prepared.slice(0, pipeIndex).trim() || prepared;
  const split = splitArtistAndName(titleWithoutPipe);

  if (split) {
    const artist = cleanArtistPart(split.artist);
    const name = cleanSongPart(split.name);

    if (artist && name) {
      return `${artist} - ${name}`;
    }
  }

  return cleanWholeTitle(titleWithoutPipe);
}

function splitArtistAndName(
  title: string,
): { artist: string; name: string } | null {
  const separator = ' - ';
  const separatorIndex = title.indexOf(separator);

  if (separatorIndex === -1) {
    return null;
  }

  const artist = title.slice(0, separatorIndex).trim();
  const name = title.slice(separatorIndex + separator.length).trim();

  if (!artist || !name) {
    return null;
  }

  return { artist, name };
}

function cleanWholeTitle(part: string): string {
  return finalizeSpacing(
    removeInlineNoise(canonicalizeBracketSegments(part, false)),
  );
}

function cleanArtistPart(part: string): string {
  return finalizeSpacing(canonicalizeBracketSegments(part, true));
}

function cleanSongPart(part: string): string {
  let cleaned = canonicalizeBracketSegments(part, false);
  cleaned = removeInlineNoise(cleaned);
  cleaned = cleaned.replace(/\s+(?:feat\.?|ft\.?|featuring)\s+.+$/i, '');
  return finalizeSpacing(cleaned);
}

function canonicalizeBracketSegments(
  part: string,
  dropFeaturedArtists: boolean,
): string {
  return part.replace(/(\[[^[\]]*\]|\([^()]*\)|\{[^{}]*\})/g, (segment) => {
    const content = segment.slice(1, -1).trim();
    if (!content) {
      return ' ';
    }

    const normalizedContent = content
      .replace(/[♂♀]/gu, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[–—−]/g, '-')
      .trim();
    if (!normalizedContent) {
      return ' ';
    }

    const isProtected =
      /\b(remix|cover|parody|gachi|right\s+version|ai\s+(?:cover|version)|sped\s*up|slowed|live|acoustic|instrumental|mashup|phonk|nightcore|extended)\b/i.test(
        normalizedContent,
      );
    const isPureNoise =
      /^(?:official(?:\s+(?:music\s+video|video|audio|lyric\s+video|visualizer))?|lyric\s+video|lyrics?(?:\s+on\s+screen)?|visualizer|clip\s+(?:officiel|oficial)|video\s+lyric\s+oficial|hd|hq|4k|1080p|720p|with\s+lyrics?|\s|[-,:;!'"`~|.])+$/i.test(
        normalizedContent,
      );

    if (!isProtected && isPureNoise) {
      return ' ';
    }

    let next = normalizedContent;
    if (dropFeaturedArtists) {
      next = next.replace(/\s+(?:feat\.?|ft\.?|featuring)\s+.+$/i, '');
    }

    next = finalizeSpacing(next);
    return next ? ` (${next}) ` : ' ';
  });
}

function removeInlineNoise(part: string): string {
  return [
    /\bofficial\s+(?:music\s+video|video|audio|lyric\s+video|visualizer)\b/gi,
    /\blyric\s+video\b/gi,
    /\blyrics?(?:\s+on\s+screen)?\b/gi,
    /\bvisualizer\b/gi,
    /\bclip\s+(?:officiel|oficial)\b/gi,
    /\bvideo\s+lyric\s+oficial\b/gi,
    /\b(?:hd|hq|4k|1080p|720p)\b/gi,
    /\bwith\s+lyrics?\b/gi,
  ].reduce((result, regex) => result.replace(regex, ' '), part);
}

function finalizeSpacing(part: string): string {
  return part
    .replace(/[♂♀]/gu, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s+([)\]])/g, '$1')
    .replace(/([([{])\s+/g, '$1')
    .replace(/^[\s"'`~|,.:;!_\-♂]+/u, '')
    .replace(/[\s"'`~|,.:;!_\-♂]+$/u, '')
    .trim();
}
