import pg from 'pg';

const DATE_OID = 1082;

export const registerPgTypeParsers = (): void => {
  pg.types.setTypeParser(DATE_OID, (value: string) => value);
};