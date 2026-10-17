import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { TicketStatus } from '../../common/constant/domain.constant.js';

@Entity({ name: 'tiket_event' })
export class TicketEvent {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid', name: 'tiket_id' })
  tiketId!: string;

  @Column({ type: 'text', name: 'dari_status', nullable: true })
  dariStatus!: TicketStatus | null;

  @Column({ type: 'text', name: 'ke_status' })
  keStatus!: TicketStatus;

  @Column({ type: 'uuid', nullable: true })
  aktor!: string | null;

  @Column({ type: 'text', nullable: true })
  catatan!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  ts!: Date;
}