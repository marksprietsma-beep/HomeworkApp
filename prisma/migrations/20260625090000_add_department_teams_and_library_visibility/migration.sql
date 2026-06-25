CREATE TYPE "DepartmentTeamRole" AS ENUM ('MEMBER', 'ADMIN');
CREATE TYPE "CurriculumLibraryVisibility" AS ENUM ('PRIVATE', 'TEAM');

CREATE TABLE "DepartmentTeam" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentTeam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DepartmentTeamMembership" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "DepartmentTeamRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepartmentTeamMembership_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CurriculumHomeworkLibraryItem" ADD COLUMN "visibility" "CurriculumLibraryVisibility" NOT NULL DEFAULT 'PRIVATE', ADD COLUMN "teamId" INTEGER;

CREATE UNIQUE INDEX "DepartmentTeam_name_key" ON "DepartmentTeam"("name");
CREATE UNIQUE INDEX "DepartmentTeamMembership_teamId_userId_key" ON "DepartmentTeamMembership"("teamId", "userId");
CREATE INDEX "DepartmentTeamMembership_userId_idx" ON "DepartmentTeamMembership"("userId");
CREATE INDEX "CurriculumHomeworkLibraryItem_teamId_idx" ON "CurriculumHomeworkLibraryItem"("teamId");
CREATE INDEX "CurriculumHomeworkLibraryItem_visibility_idx" ON "CurriculumHomeworkLibraryItem"("visibility");

ALTER TABLE "DepartmentTeamMembership" ADD CONSTRAINT "DepartmentTeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "DepartmentTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DepartmentTeamMembership" ADD CONSTRAINT "DepartmentTeamMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CurriculumHomeworkLibraryItem" ADD CONSTRAINT "CurriculumHomeworkLibraryItem_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "DepartmentTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
