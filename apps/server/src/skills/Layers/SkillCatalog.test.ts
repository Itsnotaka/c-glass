import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { parseSkillDoc, scanSkills } from "./SkillCatalog";

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("SkillCatalog", () => {
  it("parses frontmatter and trims outer blank lines from the body", () => {
    expect(
      parseSkillDoc(`---
name: tailwind
description: Tailwind CSS guidance
---

Use this skill.

`),
    ).toEqual({
      description: "Tailwind CSS guidance",
      body: "Use this skill.",
    });
  });

  it("lists real directories and symlinked skill directories", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "glass-skill-catalog-"));
    dirs.push(dir);

    const root = path.join(dir, "skills");
    const tailwind = path.join(root, "tailwind");
    const target = path.join(dir, "nia-target");

    await fs.mkdir(tailwind, { recursive: true });
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(
      path.join(tailwind, "SKILL.md"),
      `---
description: Tailwind CSS guidance
---

Use Tailwind.
`,
    );
    await fs.writeFile(
      path.join(target, "SKILL.md"),
      `---
description: Search code and docs
---

Use Nia.
`,
    );
    await fs.symlink(target, path.join(root, "nia"));

    const skills = await scanSkills(root);

    expect(skills).toEqual([
      {
        id: await fs.realpath(path.join(root, "nia")),
        name: "nia",
        description: "Search code and docs",
        body: "Use Nia.",
      },
      {
        id: await fs.realpath(tailwind),
        name: "tailwind",
        description: "Tailwind CSS guidance",
        body: "Use Tailwind.",
      },
    ]);
  });
});
