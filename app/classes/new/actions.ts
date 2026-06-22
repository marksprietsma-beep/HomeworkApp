"use server";

import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "../../../lib/prisma";
import { getSelectedLocalDevelopmentUser } from "../../../lib/local-dev-user";

export type CreateClassFormState = {
  error: string | null;
};

function readTrimmed(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createClassForSelectedTeacher(
  _previousState: CreateClassFormState,
  formData: FormData,
): Promise<CreateClassFormState> {
  let classId: number;

  try {
    const name = readTrimmed(formData, "name");
    const subject = readTrimmed(formData, "subject");
    const description = readTrimmed(formData, "description");

    if (name.length === 0) {
      throw new Error("Enter a class name.");
    }

    if (subject.length === 0) {
      throw new Error("Enter a subject.");
    }

    const { selectedUser } = await getSelectedLocalDevelopmentUser();

    if (!selectedUser || selectedUser.role !== UserRole.TEACHER) {
      throw new Error("Switch to the seeded teacher user to create classes.");
    }

    const classItem = await prisma.class.create({
      data: {
        name,
        subject,
        description: description || `A ${subject} class created locally.`,
        teacherId: selectedUser.id,
      },
      select: { id: true },
    });

    classId = classItem.id;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return { error: "A class with this name already exists. Choose a unique name." };
    }

    if (error instanceof Error) {
      return { error: error.message };
    }

    return { error: "Could not create the class. Please try again." };
  }

  redirect(`/classes/${classId}`);
}
