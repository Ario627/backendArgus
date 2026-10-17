import type { UserRole } from '../common/constant/domain.constant.js';
import type { User } from '../database/entities/user.entity.js';

export interface UserProfile {
  readonly id: string;
  readonly username: string;
  readonly nama: string;
  readonly role: UserRole;
  readonly sppgId: string | null;
  readonly facilityId: string | null;
  readonly fleetId: string | null;
}

export const toUserProfile = (user: User): UserProfile => ({
  id: user.id,
  username: user.username,
  nama: user.nama,
  role: user.role,
  sppgId: user.sppgId,
  facilityId: user.facilityId,
  fleetId: user.fleetId,
});
