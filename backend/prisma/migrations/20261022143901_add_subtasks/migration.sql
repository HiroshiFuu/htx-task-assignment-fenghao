-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "parent_id" UUID,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "idx_tasks_parent_id" ON "tasks"("parent_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
