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

  @Column({ name: 'redistributed_stops', type: 'jsonb' })
  redistributedStops!: RedistributedStop[];

  @Column({ name: 'detected_at', type: 'timestamptz' })
  detectedAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'duration_ms', type: 'integer', nullable: true })
  durationMs!: number | null;

  @Column({ name: 'fallback', type: 'boolean', default: false })
  fallback!: boolean;

  @Column({ name: 'status', type: 'varchar', default: 'success' })
  status!: RecoveryStatus;

  @Column({ name: 'llm_narrative', type: 'text', nullable: true })
  llmNarrative!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}