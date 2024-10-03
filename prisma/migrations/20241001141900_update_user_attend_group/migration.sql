-- DropForeignKey
ALTER TABLE "UserAttendGroup" DROP CONSTRAINT "UserAttendGroup_groupId_fkey";

-- DropForeignKey
ALTER TABLE "UserAttendGroup" DROP CONSTRAINT "UserAttendGroup_userId_fkey";

-- AddForeignKey
ALTER TABLE "UserAttendGroup" ADD CONSTRAINT "UserAttendGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAttendGroup" ADD CONSTRAINT "UserAttendGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
