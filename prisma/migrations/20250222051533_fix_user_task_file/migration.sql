/*
  Warnings:

  - The primary key for the `UserOnTask` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[userId,taskId]` on the table `UserOnTask` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "_FileSubmissions" DROP CONSTRAINT "_FileSubmissions_B_fkey";

-- AlterTable
ALTER TABLE "UserOnTask" DROP CONSTRAINT "UserOnTask_pkey",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "UserOnTask_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "UserOnTask_userId_taskId_key" ON "UserOnTask"("userId", "taskId");

-- AddForeignKey
ALTER TABLE "_FileSubmissions" ADD CONSTRAINT "_FileSubmissions_B_fkey" FOREIGN KEY ("B") REFERENCES "UserOnTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
