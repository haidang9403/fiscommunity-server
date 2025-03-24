/*
  Warnings:

  - You are about to drop the column `lastInteraction` on the `Chatbot` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Chatbot` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Chatbot" DROP COLUMN "lastInteraction",
DROP COLUMN "name";
