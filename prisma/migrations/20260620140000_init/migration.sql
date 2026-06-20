-- CreateTable
CREATE TABLE "LocalDatabaseCheck" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'local database baseline',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocalDatabaseCheck_pkey" PRIMARY KEY ("id")
);
