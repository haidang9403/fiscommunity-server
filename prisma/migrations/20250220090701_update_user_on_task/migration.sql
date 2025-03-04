/*
  Warnings:

  - The values [VIEW_ONLY,ADMIN] on the enum `PermissionOnTask` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PermissionOnTask_new" AS ENUM ('NONE', 'MEMBER');
ALTER TABLE "UserOnTask" ALTER COLUMN "permission" DROP DEFAULT;
ALTER TABLE "UserOnTask" ALTER COLUMN "permission" TYPE "PermissionOnTask_new" USING ("permission"::text::"PermissionOnTask_new");
ALTER TYPE "PermissionOnTask" RENAME TO "PermissionOnTask_old";
ALTER TYPE "PermissionOnTask_new" RENAME TO "PermissionOnTask";
DROP TYPE "PermissionOnTask_old";
ALTER TABLE "UserOnTask" ALTER COLUMN "permission" SET DEFAULT 'NONE';
COMMIT;
