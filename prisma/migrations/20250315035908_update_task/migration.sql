-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "isClass" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "_FileSubmissionsUser" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_FileSubmissionsUser_AB_unique" ON "_FileSubmissionsUser"("A", "B");

-- CreateIndex
CREATE INDEX "_FileSubmissionsUser_B_index" ON "_FileSubmissionsUser"("B");

-- AddForeignKey
ALTER TABLE "_FileSubmissionsUser" ADD CONSTRAINT "_FileSubmissionsUser_A_fkey" FOREIGN KEY ("A") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FileSubmissionsUser" ADD CONSTRAINT "_FileSubmissionsUser_B_fkey" FOREIGN KEY ("B") REFERENCES "UserOnTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
