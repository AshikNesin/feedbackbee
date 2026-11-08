// Todos: create, complete, persist across reload, delete. Each mutation is
// checked in the UI and in the `todos` table.
//   node .agents/skills/verify-groot/scripts/drive.mjs <run> .agents/skills/verify-groot/journeys/todos.mjs
export default async function todos({ page, step, expect, db, note }) {
  const title = `Verify todo ${Date.now()}`;
  const row = () => page.getByRole("listitem").filter({ hasText: title });

  await step("open todos page", async () => {
    await page.goto("/todos");
    await expect(page.getByRole("heading", { name: "Todos", level: 1 })).toBeVisible();
    await expect(page.getByText("Build an API")).toBeVisible(); // seeded
  });

  const before = db("select count(*) as n from todos")[0].n;

  await step("create todo from dialog", async () => {
    await page.getByRole("button", { name: "Create Todo" }).click();
    await expect(page.getByRole("dialog", { name: "Add Todo" })).toBeVisible();
    await page.getByLabel("Title").fill(title);
    await page.getByRole("dialog").getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByText("Todo created")).toBeVisible(); // toast
    // By design the dialog stays open with a cleared form, ready for the next todo.
    await expect(page.getByRole("dialog").getByLabel("Title")).toHaveValue("");
  });

  // The modal hides the page from the accessibility tree; close it to see the list.
  await step("close the dialog, new todo is listed", async () => {
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(row()).toBeVisible();
    await expect(row().getByText("Pending")).toBeVisible();
  });

  const created = db("select id, title, completed from todos where title = ?", title);
  if (created.length !== 1 || created[0].completed !== 0) {
    throw new Error(`expected one pending row for "${title}", got ${JSON.stringify(created)}`);
  }
  note(`db: inserted ${JSON.stringify(created[0])}; count ${before} → ${before + 1}`);

  await step("mark todo done", async () => {
    await page.getByRole("checkbox", { name: `Mark ${title} as done` }).click();
    await expect(page.getByRole("checkbox", { name: `Mark ${title} as pending` })).toBeChecked();
    await expect(row().getByText("Done")).toBeVisible();
  });

  await expect
    .poll(() => db("select completed from todos where title = ?", title)[0]?.completed, {
      timeout: 15_000,
    })
    .toBe(1);
  note("db: completed = 1");

  await step("reload shows it still done", async () => {
    await page.reload();
    await expect(page.getByRole("checkbox", { name: `Mark ${title} as pending` })).toBeChecked();
  });

  await step("delete todo", async () => {
    await page.getByRole("button", { name: `Delete ${title}` }).click();
    await expect(row()).toHaveCount(0);
  });

  await expect
    .poll(() => db("select count(*) as n from todos where title = ?", title)[0].n, {
      timeout: 15_000,
    })
    .toBe(0);
  note("db: row deleted");
}
