import { DestinationType } from "src/common/constant/destination.constant";
import { DEFAULT_DESTINATION_PRIORITY, DEFAULT_DESTINATION_CAPACITY_KG } from "src/common/constant/destination.constant";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('destination')
@Index(['type'])
export class DestinationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'enum', enum: DestinationType })
  type!: DestinationType;

  @Column({ type: 'double precision' })
  latitude!: number;

  @Column({ type: 'double precision' })
  longitude!: number;

  @Column({
    type: 'integer',
    default: DEFAULT_DESTINATION_CAPACITY_KG,
  })
  capacityKg!: number;

  @Column({ type: 'integer', default: DEFAULT_DESTINATION_PRIORITY })
  priority!: number;

  @Column({ type: 'boolean', default: false })
  lowVolumeFlag!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}