-- Move the hhb_ tables out of the shared `public` schema into a dedicated `hhb`
-- schema. SET SCHEMA keeps rows, indexes, constraints and the FK intact.
-- (Hand-written: a generated diff would CREATE empty tables instead of moving.)
BEGIN;
CREATE SCHEMA IF NOT EXISTS "hhb";
ALTER TABLE "public"."hhb_user" SET SCHEMA "hhb";
ALTER TABLE "public"."hhb_solve" SET SCHEMA "hhb";
COMMIT;
