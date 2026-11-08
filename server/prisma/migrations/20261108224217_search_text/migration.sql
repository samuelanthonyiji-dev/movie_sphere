-- AlterTable
ALTER TABLE "Movie" ADD COLUMN     "searchText" TEXT NOT NULL DEFAULT '';

-- Trigram index for fast partial-match search
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- on Supabase this already exists in the "extensions" schema
CREATE INDEX IF NOT EXISTS "Movie_searchText_trgm_idx" ON "Movie" USING GIN ("searchText" gin_trgm_ops);
