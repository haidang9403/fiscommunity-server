-- CreateTable
CREATE TABLE "_AdminConversation" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_AdminConversation_AB_unique" ON "_AdminConversation"("A", "B");

-- CreateIndex
CREATE INDEX "_AdminConversation_B_index" ON "_AdminConversation"("B");

-- AddForeignKey
ALTER TABLE "_AdminConversation" ADD CONSTRAINT "_AdminConversation_A_fkey" FOREIGN KEY ("A") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AdminConversation" ADD CONSTRAINT "_AdminConversation_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
