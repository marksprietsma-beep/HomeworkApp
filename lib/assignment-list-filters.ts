export type AssignmentStatusFilter = "all" | "DRAFT" | "PUBLISHED";
export type AssignmentDueFilter = "all" | "upcoming" | "overdue" | "no-date";
export type AssignmentSortKey =
  | "newest"
  | "oldest"
  | "due-date"
  | "title"
  | "status";

export type AssignmentListFilters = {
  status: AssignmentStatusFilter;
  classId: string;
  due: AssignmentDueFilter;
  search: string;
  sort: AssignmentSortKey;
};

export type FilterableAssignment = {
  title: string;
  status: string;
  classId?: number | string;
  dueAt: Date | null;
  createdAt: Date;
};

export const statusFilterOptions: { value: AssignmentStatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
];

export const dueFilterOptions: { value: AssignmentDueFilter; label: string }[] = [
  { value: "all", label: "Any due date" },
  { value: "upcoming", label: "Upcoming" },
  { value: "overdue", label: "Overdue" },
  { value: "no-date", label: "No due date" },
];

export const sortOptions: { value: AssignmentSortKey; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "due-date", label: "Due date" },
  { value: "title", label: "Title" },
  { value: "status", label: "Status" },
];

function readParam(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string,
) {
  const value = searchParams?.[key];
  return Array.isArray(value) ? value[0] : value;
}

export function parseAssignmentListFilters(
  searchParams?: Record<string, string | string[] | undefined>,
): AssignmentListFilters {
  const status = readParam(searchParams, "status");
  const due = readParam(searchParams, "due");
  const sort = readParam(searchParams, "sort");
  const classId = readParam(searchParams, "classId") ?? "all";
  const search = (readParam(searchParams, "search") ?? "").trim();

  return {
    status: status === "DRAFT" || status === "PUBLISHED" ? status : "all",
    classId: classId && classId !== "all" ? classId : "all",
    due:
      due === "upcoming" || due === "overdue" || due === "no-date"
        ? due
        : "all",
    search,
    sort:
      sort === "oldest" || sort === "due-date" || sort === "title" || sort === "status"
        ? sort
        : "newest",
  };
}

export function filterAndSortAssignments<T extends FilterableAssignment>(
  assignments: T[],
  filters: AssignmentListFilters,
  now = new Date(),
): T[] {
  const normalizedSearch = filters.search.toLocaleLowerCase();

  return assignments
    .filter((assignment) => {
      if (filters.status !== "all" && assignment.status !== filters.status) {
        return false;
      }

      if (
        filters.classId !== "all" &&
        assignment.classId !== undefined &&
        String(assignment.classId) !== filters.classId
      ) {
        return false;
      }

      if (
        normalizedSearch &&
        !assignment.title.toLocaleLowerCase().includes(normalizedSearch)
      ) {
        return false;
      }

      if (filters.due === "no-date") {
        return assignment.dueAt === null;
      }

      if (filters.due === "upcoming") {
        return assignment.dueAt !== null && assignment.dueAt >= now;
      }

      if (filters.due === "overdue") {
        return assignment.dueAt !== null && assignment.dueAt < now;
      }

      return true;
    })
    .sort((a, b) => compareAssignments(a, b, filters.sort));
}

function compareAssignments<T extends FilterableAssignment>(
  a: T,
  b: T,
  sort: AssignmentSortKey,
) {
  if (sort === "oldest") {
    return a.createdAt.getTime() - b.createdAt.getTime() || compareTitle(a, b);
  }

  if (sort === "due-date") {
    return compareNullableDates(a.dueAt, b.dueAt) || compareTitle(a, b);
  }

  if (sort === "title") {
    return compareTitle(a, b) || b.createdAt.getTime() - a.createdAt.getTime();
  }

  if (sort === "status") {
    return a.status.localeCompare(b.status) || compareTitle(a, b);
  }

  return b.createdAt.getTime() - a.createdAt.getTime() || compareTitle(a, b);
}

function compareTitle<T extends Pick<FilterableAssignment, "title">>(a: T, b: T) {
  return a.title.localeCompare(b.title);
}

function compareNullableDates(a: Date | null, b: Date | null) {
  if (a && b) {
    return a.getTime() - b.getTime();
  }

  if (a) {
    return -1;
  }

  if (b) {
    return 1;
  }

  return 0;
}
