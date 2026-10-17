export interface RetentionPolicyInput {
  readonly now: Date;
  readonly dropAfterDays: number;
  readonly photoTicketDays: number;
  readonly photoBatchDays: number;
}

export interface RetentionWindows {
  readonly telemetryBefore: Date;
  readonly photoTicketBefore: Date;
  readonly photoBatchBefore: Date;
}

const DAY_MS = 86400000;

const daysBefore = (now: Date, days: number): Date =>
  new Date(now.getTime() - days * DAY_MS);

export const resolveRetentionWindows = (
  input: RetentionPolicyInput,
): RetentionWindows =>
  Object.freeze({
    telemetryBefore: daysBefore(input.now, input.dropAfterDays),
    photoTicketBefore: daysBefore(input.now, input.photoTicketDays),
    photoBatchBefore: daysBefore(input.now, input.photoBatchDays),
  });