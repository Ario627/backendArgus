import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'narasi_dashboard' })
export class NarrativeCacheEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'text', name: 'cache_key' })
  cacheKey!: string;

  @Column({ type: 'uuid', name: 'sppg_id', nullable: true })
  sppgId!: string | null;

  @Column({ type: 'date' })
  tanggal!: string;

  @Column({ type: 'text' })
  model!: string;

  @Column({ type: 'text' })
  narasi!: string;

  @Column({ type: 'int', name: 'prompt_tokens', nullable: true })
  promptTokens!: number | null;

  @Column({ type: 'int', name: 'completion_tokens', nullable: true })
  completionTokens!: number | null;

  @Column({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;
}