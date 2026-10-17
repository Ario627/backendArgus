ALTER TABLE "user" ADD COLUMN fleet_id UUID REFERENCES fleet(id);

CREATE INDEX user_fleet ON "user" (fleet_id) WHERE fleet_id IS NOT NULL;