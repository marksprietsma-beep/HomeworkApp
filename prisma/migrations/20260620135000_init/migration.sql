-- CreateTable
CREATE TABLE "LocalDatabaseCheck" (
    "id" SERIAL NOT NULL,
    "message" TEXT NOT NULL DEFAULT 'local database is reachable',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocalDatabaseCheck_pkey" PRIMARY KEY ("id")
);
