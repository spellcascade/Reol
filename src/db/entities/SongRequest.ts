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

  // song name
  @Column({ default: '' })
  name?: string;

  @Column({ default: '' })
  artist?: string;

  @Column()
  requestedBy: string;

  @Column()
  guildId: string;

  @Column({ nullable: true, default: null })
  spotifyId?: string;

  @CreateDateColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  requestedAt: Date;
}
