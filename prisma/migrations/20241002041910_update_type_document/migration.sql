-- AlterTable
ALTER TABLE "File" ADD COLUMN     "privacy" "TypePrivacy" NOT NULL DEFAULT 'PUBLIC';

-- AlterTable
ALTER TABLE "Folder" ADD COLUMN     "privacy" "TypePrivacy" NOT NULL DEFAULT 'PUBLIC';
