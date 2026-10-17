import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { UserRole } from '../../common/constant/domain.constant.js';

@Entity({ name: 'audit_log' })
export class AuditLog {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  aktor!: string | null;

  @Column({ type: 'text', name: 'aktor_peran', nullable: true })
  aktorPeran!: UserRole | null;

  @Column({ type: 'text' })
  aksi!: string;

  @Column({ type: 'text', nullable: true })
  entitas!: string | null;

  @Column({ type: 'text', name: 'entitas_id', nullable: true })
  entitasId!: string | null;

  @Column({ type: 'jsonb' })
  detail!: Record<string, unknown>;

  @Column({ type: 'text', name: 'request_id', nullable: true })
  requestId!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  ts!: Date;
}