-- CreateEnum
CREATE TYPE "skill_source" AS ENUM ('USER', 'LLM', 'FALLBACK');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "skill_source" "skill_source" NOT NULL DEFAULT 'USER';
