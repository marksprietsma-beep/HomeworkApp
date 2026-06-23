import { UserRole } from "@prisma/client";

export type RoleBearingUser = {
  role: UserRole;
};

export function hasRole(user: RoleBearingUser | null | undefined, role: UserRole) {
  return user?.role === role;
}

export function isAdmin(user: RoleBearingUser | null | undefined) {
  return hasRole(user, UserRole.ADMIN);
}

export function isTeacher(user: RoleBearingUser | null | undefined) {
  return hasRole(user, UserRole.TEACHER);
}

export function isStudent(user: RoleBearingUser | null | undefined) {
  return hasRole(user, UserRole.STUDENT);
}

export function canManageUsers(user: RoleBearingUser | null | undefined) {
  return isAdmin(user);
}

export function canManageClasses(user: RoleBearingUser | null | undefined) {
  return isAdmin(user);
}

export function canTeachClass(
  user: (RoleBearingUser & { id: number }) | null | undefined,
  teacherId: number,
) {
  if (!user) {
    return false;
  }

  return isTeacher(user) && user.id === teacherId;
}

export function canSubmitAssignedWork(user: RoleBearingUser | null | undefined) {
  return isStudent(user);
}
