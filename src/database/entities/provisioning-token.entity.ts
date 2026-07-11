import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum TokenStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

@Entity('provisioning_tokens')
@Index(['token'], { unique: true })
@Index(['deviceId'])
export class ProvisioningTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'token', type: 'varchar', length: 128, unique: true })
  token!: string;

  @Column({ name: 'device_id', type: 'varchar', length: 64, nullable: true })
  deviceId!: string | null;

  @Column({ name: 'fleet_id', type: 'uuid', nullable: true })
  fleetId!: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: TokenStatus,
    default: TokenStatus.ACTIVE,
  })
  status!: TokenStatus;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}