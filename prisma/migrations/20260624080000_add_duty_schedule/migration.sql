CREATE TABLE "DutySchedule" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "sourceTimetableImportId" INTEGER,
    "sourceTimetableName" TEXT,
    "scheduleJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DutySchedule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DutySchedule_isActive_idx" ON "DutySchedule"("isActive");
CREATE INDEX "DutySchedule_sourceTimetableImportId_idx" ON "DutySchedule"("sourceTimetableImportId");
CREATE INDEX "DutySchedule_updatedAt_idx" ON "DutySchedule"("updatedAt");

ALTER TABLE "DutySchedule" ADD CONSTRAINT "DutySchedule_sourceTimetableImportId_fkey" FOREIGN KEY ("sourceTimetableImportId") REFERENCES "TimetableImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
