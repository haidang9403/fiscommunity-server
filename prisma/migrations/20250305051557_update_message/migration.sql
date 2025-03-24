-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "replyId" INTEGER,
ALTER COLUMN "senderId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
