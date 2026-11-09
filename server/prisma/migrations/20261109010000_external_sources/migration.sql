-- AlterEnum
ALTER TYPE "RightsBasis" ADD VALUE 'OPEN_LICENSE';

-- AlterTable
ALTER TABLE "Movie" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "license" TEXT,
ADD COLUMN     "ratingSource" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'local',
ADD COLUMN     "sourceUrl" TEXT,
ADD COLUMN     "tmdbId" INTEGER;

-- AlterTable
ALTER TABLE "MovieFile" ADD COLUMN     "externalUrl" TEXT,
ALTER COLUMN "storageKey" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Subtitle" ADD COLUMN     "externalUrl" TEXT,
ALTER COLUMN "storageKey" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Movie_externalId_key" ON "Movie"("externalId");

-- CreateIndex
CREATE INDEX "Movie_source_idx" ON "Movie"("source");

