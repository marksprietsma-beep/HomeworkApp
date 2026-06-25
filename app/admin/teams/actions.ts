"use server";

import { DepartmentTeamRole, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSelectedLocalDevelopmentUser } from "../../../lib/local-dev-user";
import { canManageUsers } from "../../../lib/permissions";
import { prisma } from "../../../lib/prisma";

function read(formData: FormData, key: string) { return String(formData.get(key) ?? "").trim(); }
async function assertAdmin() {
  const { selectedUser } = await getSelectedLocalDevelopmentUser();
  if (!canManageUsers(selectedUser)) throw new Error("Department/team management is admin-only.");
}
function id(value: FormDataEntryValue | null, label: string) { const n = Number(String(value ?? "")); if (!Number.isInteger(n) || n <= 0) throw new Error(`Choose a valid ${label}.`); return n; }
function refresh() { revalidatePath("/admin/teams"); revalidatePath("/curriculum-library"); }

export async function createDepartmentTeam(formData: FormData) {
  await assertAdmin();
  const name = read(formData, "name");
  if (!name) throw new Error("Enter a team name.");
  await prisma.departmentTeam.create({ data: { name, description: read(formData, "description") || null } });
  refresh();
}

export async function updateDepartmentTeam(formData: FormData) {
  await assertAdmin();
  const teamId = id(formData.get("teamId"), "team");
  const name = read(formData, "name");
  if (!name) throw new Error("Enter a team name.");
  await prisma.departmentTeam.update({ where: { id: teamId }, data: { name, description: read(formData, "description") || null } });
  refresh();
}

export async function addDepartmentTeamMember(formData: FormData) {
  await assertAdmin();
  const teamId = id(formData.get("teamId"), "team");
  const userId = id(formData.get("userId"), "teacher");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user || user.role !== UserRole.TEACHER) throw new Error("Only teacher users can be added as team members in v1.");
  await prisma.departmentTeamMembership.upsert({ where: { teamId_userId: { teamId, userId } }, update: {}, create: { teamId, userId, role: DepartmentTeamRole.MEMBER } });
  refresh();
}

export async function removeDepartmentTeamMember(formData: FormData) {
  await assertAdmin();
  await prisma.departmentTeamMembership.delete({ where: { id: id(formData.get("membershipId"), "membership") } });
  refresh();
}
