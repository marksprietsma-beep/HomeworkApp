CREATE TABLE "TimetableImport" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sourceFilename" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "rawAnalysisJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableImport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TimetableImport_isActive_idx" ON "TimetableImport"("isActive");
CREATE INDEX "TimetableImport_updatedAt_idx" ON "TimetableImport"("updatedAt");
