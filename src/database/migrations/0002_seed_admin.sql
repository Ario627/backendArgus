INSERT INTO "user" (username, password_hash, role, fleet_id)
VALUES (
  'admin',
  '$2b$10$N9qo8uLOickgx2ZMRZoMy.MrqJQvQZJqXk7zQqYBQqYBQqYBQqYB',
  'admin',
  NULL
)
ON CONFLICT (username) DO NOTHING;
