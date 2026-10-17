import { pbkdf2Sync, randomBytes } from 'node:crypto';

const MOSQUITTO_PBKDF2_ITERATIONS = 1000;
const MOSQUITTO_SALT_BYTES = 12;
const MOSQUITTO_KEY_BYTES = 64;
const MQTT_USERNAME_BYTES = 4;
const MQTT_PASSWORD_BYTES = 18;

export const generateMqttUsername = (): string =>
  `dev_${randomBytes(MQTT_USERNAME_BYTES).toString('hex')}`;

export const generateMqttPassword = (): string =>
  randomBytes(MQTT_PASSWORD_BYTES).toString('base64url');

export const mosquittoPasswordHash = (password: string): string => {
  const salt = randomBytes(MOSQUITTO_SALT_BYTES);
  const derived = pbkdf2Sync(
    password,
    salt,
    MOSQUITTO_PBKDF2_ITERATIONS,
    MOSQUITTO_KEY_BYTES,
    'sha512',
  );
  return `$7$${MOSQUITTO_PBKDF2_ITERATIONS}$${salt.toString('base64')}$${derived.toString('base64')}`;
};