/*
  Warnings:

  - The values [ON_HOLD] on the enum `StatusTask` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `settings` on the `Chatbot` table. All the data in the column will be lost.
  - You are about to drop the column `isFromChatbotAI` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `actualEndDate` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `actualStartDate` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `approveById` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `assignedToId` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `endDate` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `isApproved` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `projectId` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the `Project` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProjectMember` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TaskAttachment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TaskComment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TaskDependency` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TaskHistory` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `deadline` to the `Task` table without a default value. This is not possible if the table is not empty.
  - Added the required column `description` to the `Task` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Task` table without a default value. This is not possible if the table is not empty.
  - Added the required column `workspaceId` to the `Task` table without a default value. This is not possible if the table is not empty.

*/

-- CreateEnum
CREATE TYPE "PermissionOnTask" AS ENUM ('NONE', 'VIEW_ONLY', 'MEMBER', 'ADMIN');

-- AlterEnum
BEGIN;
CREATE TYPE "StatusTask_new" AS ENUM ('PENDING', 'IN_PROGRESS', 'PENDING_PREVIEW', 'COMPLETED', 'FAILED', 'OVERDUE');
ALTER TABLE "Task" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "status" TYPE "StatusTask_new" USING ("status"::text::"StatusTask_new");
ALTER TYPE "StatusTask" RENAME TO "StatusTask_old";
ALTER TYPE "StatusTask_new" RENAME TO "StatusTask";
DROP TYPE "StatusTask_old" CASCADE;
ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TypeMessage" ADD VALUE 'ANNOUNCEMENT';
ALTER TYPE "TypeMessage" ADD VALUE 'CHATBOT';
ALTER TYPE "TypeMessage" ADD VALUE 'CODE';

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_userId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectMember" DROP CONSTRAINT "ProjectMember_memberId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectMember" DROP CONSTRAINT "ProjectMember_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_approveById_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_assignedToId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_projectId_fkey";

-- DropForeignKey
ALTER TABLE "TaskAttachment" DROP CONSTRAINT "TaskAttachment_uploadById_fkey";

-- DropForeignKey
ALTER TABLE "TaskComment" DROP CONSTRAINT "TaskComment_taskId_fkey";

-- DropForeignKey
ALTER TABLE "TaskDependency" DROP CONSTRAINT "task_dependency_dependsOn_fk";

-- DropForeignKey
ALTER TABLE "TaskDependency" DROP CONSTRAINT "task_dependency_task_fk";

-- DropForeignKey
ALTER TABLE "TaskHistory" DROP CONSTRAINT "TaskHistory_changedById_fkey";

-- DropForeignKey
ALTER TABLE "TaskHistory" DROP CONSTRAINT "TaskHistory_taskId_fkey";

-- AlterTable
ALTER TABLE "Chatbot" DROP COLUMN "settings",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastInteraction" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "chatbotId" INTEGER,
ADD COLUMN     "isChatbot" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "isFromChatbotAI";

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "actualEndDate",
DROP COLUMN "actualStartDate",
DROP COLUMN "approveById",
DROP COLUMN "assignedToId",
DROP COLUMN "endDate",
DROP COLUMN "isApproved",
DROP COLUMN "name",
DROP COLUMN "projectId",
DROP COLUMN "startDate",
ADD COLUMN     "deadline" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "workspaceId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "Project";

-- DropTable
DROP TABLE "ProjectMember";

-- DropTable
DROP TABLE "TaskAttachment";

-- DropTable
DROP TABLE "TaskComment";

-- DropTable
DROP TABLE "TaskDependency";

-- DropTable
DROP TABLE "TaskHistory";

-- DropEnum
DROP TYPE "AttachmentType";

-- DropEnum
DROP TYPE "DependencyStatus";

-- DropEnum
DROP TYPE "RelationType";

-- CreateTable
CREATE TABLE "Workspace" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "conversationId" INTEGER NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" INTEGER NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserOnTask" (
    "permission" "PermissionOnTask" NOT NULL DEFAULT 'NONE',
    "userId" INTEGER NOT NULL,
    "taskId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserOnTask_pkey" PRIMARY KEY ("userId","taskId")
);

-- CreateTable
CREATE TABLE "_TaskFiles" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_AnnouncementFiles" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_TaskFiles_AB_unique" ON "_TaskFiles"("A", "B");

-- CreateIndex
CREATE INDEX "_TaskFiles_B_index" ON "_TaskFiles"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_AnnouncementFiles_AB_unique" ON "_AnnouncementFiles"("A", "B");

-- CreateIndex
CREATE INDEX "_AnnouncementFiles_B_index" ON "_AnnouncementFiles"("B");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOnTask" ADD CONSTRAINT "UserOnTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOnTask" ADD CONSTRAINT "UserOnTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskFiles" ADD CONSTRAINT "_TaskFiles_A_fkey" FOREIGN KEY ("A") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskFiles" ADD CONSTRAINT "_TaskFiles_B_fkey" FOREIGN KEY ("B") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AnnouncementFiles" ADD CONSTRAINT "_AnnouncementFiles_A_fkey" FOREIGN KEY ("A") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AnnouncementFiles" ADD CONSTRAINT "_AnnouncementFiles_B_fkey" FOREIGN KEY ("B") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
