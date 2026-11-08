# Todos

The Todos page at `/todos` is the app's home after login. It lists todos newest
first with a total/done summary, and lets the user add a todo, mark it done or
pending, and delete it. Every change is saved to the `todos` table.

## Sub-features

- `todos-list` shows the list, `N total`, `N done` and `% complete`.
- `todos-create` adds a todo from the `Add Todo` dialog.
- `todos-toggle` marks a todo done or pending with its checkbox.
- `todos-delete` removes a todo with its trash button, with no confirm.
- `todos-validate` rejects an empty title with `Title is required`.

## How to get to it (user POV)

- Sign in. The app lands on `/todos`.
- Choose `Todos` in the sidebar, or go to `/` (it redirects to `/todos`).
- Choose `Create Todo` at the top right to open the dialog.

## Driving it with drive.mjs

Preconditions:

- Baseline seed: three todos, `Build an API` visible.
- Logged in (the driver's default).

Run the proven journey:
`node .agents/skills/verify-groot/scripts/drive.mjs <run> .agents/skills/verify-groot/journeys/todos.mjs`.
It covers the following.

- **Open list.** `page.goto("/todos")`. A heading named `Todos` (level 1) and
  the text `Build an API` are visible.
- **Create.** Choose `Create Todo`, fill `getByLabel("Title")`, then choose
  `getByRole("dialog").getByRole("button", { name: "Create", exact: true })`.
  Toast text `Todo created` appears and the dialog's Title field is empty
  again. `db("select * from todos where title = ?", title)` returns one row
  with `completed = 0`.
- **Close and see it.** Choose the dialog's `Close` button. The listitem with
  the title shows `Pending`.
- **Toggle.** Click checkbox `Mark <title> as done`. It becomes
  `Mark <title> as pending`, is checked, and the row shows `Done`. The row now
  has `completed = 1`.
- **Persist.** `page.reload()`. The checkbox `Mark <title> as pending` is
  still checked.
- **Delete.** Choose button `Delete <title>`. The listitem is gone and the row
  count for the title is 0.
- **Validate (not in the journey).** Open the dialog, leave Title empty and
  choose `Create`. `Title is required` shows and no row is inserted.

## Gotchas

- The dialog does not close after Create. It clears the form for the next
  todo, so close it yourself.
- While the dialog is open the list is hidden from `getByRole`, so assert on
  rows only after closing it.
- Toggle and delete hit the API asynchronously. Use `expect.poll` on `db()`
  rather than querying right after the click.
- The seeded `Learn Drizzle` is already done. Don't use it as a pending
  fixture.
