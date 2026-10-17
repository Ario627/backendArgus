import { customAlphabet } from 'nanoid';
import { v7 as uuidv7 } from 'uuid';

export const PUBLIC_SLUG_LENGTH = 12;

const PUBLIC_SLUG_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

export const generateId = (): string => uuidv7();

const randomSlug = customAlphabet(PUBLIC_SLUG_ALPHABET, PUBLIC_SLUG_LENGTH);

export const generatePublicSlug = (): string => randomSlug();
