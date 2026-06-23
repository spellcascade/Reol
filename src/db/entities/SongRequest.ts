import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity()
export class SongRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  url: string;

  @Column()
  title: string;

  @Column()
  guildId: string;

  @Column({ type: 'integer', nullable: true })
  trackId: number | null;

  @Column({ default: '' })
  normalizedTitle: string;

  @Column()
  requestedBy: string;

  @CreateDateColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  requestedAt: Date;
}
