import type { UserRole } from "src/common/types";
import { FleetEntity } from "./fleet.entity";
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('user')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  username!: string;

  @Column({ type: 'varchar', select: false })
  passwordHash!: string;

  @Column({ type: 'varchar' })
  role!: UserRole;

  @Column({ type: 'varchar', name: 'fleet_id', nullable: true })
  fleetId!: string | null;

  @ManyToOne(() => FleetEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'fleet_id', referencedColumnName: 'id' })
  fleet!: FleetEntity | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}