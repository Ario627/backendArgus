import { createHash } from "node:crypto";
import { jakartaDateOf } from "../common/utils/daily-range.util.js";

export const monthKeyOf = (instant: Date): string => jakartaDateOf(instant).slice(0, 7);

export const hashIpPelapor = (ip: string, salt: string, instant: Date): string =>
  createHash('sha256')
    .update(`${ip}|${salt}|${monthKeyOf(instant)}`, 'utf8')
    .digest('hex');

