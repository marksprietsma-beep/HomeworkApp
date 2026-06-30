# Dev-only bulk submission seeding

This guide is for local development testing of the feedback JSON workflow. The commands below create clearly fake submitted answers for every student in one class, so you do not need to log in as each student manually.

> Dev-only safety: these commands are scripts, not app pages. They are not visible to students. They refuse to run when `NODE_ENV=production`.

## 1. Import the CSV test students first

1. Start Clarion locally with the usual local database running.
2. Open the app in the browser.
3. Sign in/select a teacher or admin development user.
4. Create or open the class you want to test, for example `Y10 Test Class`.
5. Use the class CSV import tool to import the 15 test students.
6. Confirm the class page shows the imported students in the roster.

## 2. Create or import a test assignment

1. From the same class page, create an assignment manually or use the assignment JSON import flow.
2. Use a memorable title, for example `14.2 Packet Switching and Circuit Switching`.
3. Make sure the assignment has questions. The seeder creates one fake answer per assignment question for each enrolled student.

## 3. Find the exact class name and assignment title

Open PowerShell in the repository folder, then run:

```powershell
npm run list:classes
```

Expected output looks like:

```text
Classes:
- id=1 | name="Y10 Test Class" | subject="Computer Science" | teacher="Mark Sprietsma" <mark@example.test> | students=15 | assignments=1 | status=ACTIVE
```

To list assignments, run either:

```powershell
npm run list:assignments
```

or filter to one class:

```powershell
npm run list:assignments -- --className "Y10 Test Class"
```

Expected output looks like:

```text
Assignments:
- id=2 | title="14.2 Packet Switching and Circuit Switching" | class="Y10 Test Class" (id=1) | questions=6 | submissions=0 | status=PUBLISHED
```

## 4. Seed fake submissions from PowerShell

Use the human-readable names when they are unique:

```powershell
npm run seed:submissions -- --className "Y10 Test Class" --assignmentTitle "14.2 Packet Switching and Circuit Switching"
```

You can also use raw IDs from the list commands:

```powershell
npm run seed:submissions -- --classId 1 --assignmentId 2
```

Successful output looks like:

```text
Dev submission seeding complete.
Class: "Y10 Test Class" (id=1)
Assignment: "14.2 Packet Switching and Circuit Switching" (id=2)
Students processed: 15
Questions answered per student: 6
Submissions: 15 created, 0 updated/reused
Answers: 90 created, 0 updated/reused
Quality bands: first third strong, second third partial, final third weak.
```

The script is idempotent. If you run the same command again, it reuses the same submission for each student and the same answer for each question instead of creating duplicates. You should see created counts drop to zero and updated/reused counts increase.

## 5. If a class name or assignment title is ambiguous

The seeder stops instead of guessing. It prints matching options with IDs, for example:

```text
Assignment title "Packet Switching" is ambiguous. Use --assignmentId with one of these options:
- id=2 | title="14.2 Packet Switching and Circuit Switching" | class="Y10 Test Class" (id=1) | questions=6
- id=3 | title="Packet Switching recap" | class="Y10 Test Class" (id=1) | questions=4
```

Copy the ID you want and rerun with `--classId` and `--assignmentId`.

## 6. Confirm in the browser

1. Refresh the teacher assignment responses page for that assignment.
2. Every enrolled student should now have a submitted response.
3. Open a few responses. The first third of the class should have mostly correct fake answers, the second third partially correct answers, and the final third weak or vague answers.

## 7. Continue with feedback JSON testing

After seeding submissions:

1. Generate/copy the feedback prompt or response export for the assignment.
2. Ask ChatGPT to create feedback JSON from the exported responses.
3. Import the feedback JSON back into Clarion.
4. Review the imported Draft feedback.
5. Release feedback when ready.
