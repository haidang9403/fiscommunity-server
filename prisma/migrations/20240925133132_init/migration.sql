-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "postShareId" INTEGER;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_postShareId_fkey" FOREIGN KEY ("postShareId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
