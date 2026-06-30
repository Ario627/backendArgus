import { FleetEntity } from './fleet.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type RecoveryStatus = 'success' | 'no_receiver' | 'fallback_greedy';

export interface RedistributedStop {
  destId: string;
  demandKg: number;
  receiverFleetId: string;
}

@Entity('recovery_log')
@Index(['brokenFleetId'])
@Index(['detectedAt'])
export class RecoveryLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', name: 'broken_fleet_id' })
  brokenFleetId!: string;

  @ManyToOne(() => FleetEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'broken_fleet_id', referencedColumnName: 'id' })
  brokenFleet!: FleetEntity;

  @Column({ type: 'jsonb' })
  receivingFleetIds!: string[];

  @Column({ type: 'jsonb' })
  redistributedStops!: RedistributedStop[];

  @Column({ type: 'timestamptz' })
  detectedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'integer', nullable: true })
  durationMs!: number | null;

  @Column({ type: 'boolean', default: false })
  fallback!: boolean;

  @Column({ type: 'varchar', default: 'success' })
  status!: RecoveryStatus;

  @Column({ type: 'text', nullable: true })
  llmNarrative!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}