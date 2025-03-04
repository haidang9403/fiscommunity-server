/*
  Warnings:

  - You are about to drop the column `content` on the `TaskHistory` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ActionTask" AS ENUM ('NONE', 'STATUS_CHANGED', 'TITLE_UPDATED', 'DESCRIPTION_UPDATED', 'DEADLINE_UPDATED', 'SUBMIT_AT_UPDATED', 'USER_ASSIGNED', 'USER_UNASSIGNED', 'FILE_ATTACHED', 'FILE_DELETED', 'FILE_SUBMITTED', 'FILE_REMOVED', 'TASK_COMPLETED');

-- AlterTable
ALTER TABLE "TaskHistory" DROP COLUMN "content",
ADD COLUMN     "action" "ActionTask" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "newValue" TEXT,
ADD COLUMN     "oldValue" TEXT;
