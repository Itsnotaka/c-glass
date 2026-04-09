import { describe, expect, it } from "vitest";

import { applySkill, expandSkills, hydrateSkills, shiftSkills } from "./skill-tokens";

describe("skill-tokens", () => {
  it("drops a tracked skill when the edit touches the token", () => {
    const prev = "/tailwind hello";
    const next = "/tailwXnd hello";
    const skills = [
      {
        id: "/Users/workgyver/.agents/skills/tailwind",
        name: "tailwind",
        start: 0,
        end: "/tailwind".length,
      },
    ];

    expect(shiftSkills(prev, next, skills)).toEqual([]);
  });

  it("shifts a tracked skill when text is inserted before it", () => {
    const prev = "/tailwind hello";
    const next = "Use /tailwind hello";
    const skills = [
      {
        id: "/Users/workgyver/.agents/skills/tailwind",
        name: "tailwind",
        start: 0,
        end: "/tailwind".length,
      },
    ];

    expect(shiftSkills(prev, next, skills)).toEqual([
      {
        id: "/Users/workgyver/.agents/skills/tailwind",
        name: "tailwind",
        start: 4,
        end: 4 + "/tailwind".length,
      },
    ]);
  });

  it("expands only hydrated tracked skills", () => {
    const text = "/tailwind build\n/plain text";
    const skills = hydrateSkills(
      text,
      [
        {
          id: "/Users/workgyver/.agents/skills/tailwind",
          name: "tailwind",
          start: 0,
          end: "/tailwind".length,
        },
        {
          id: "/Users/workgyver/.agents/skills/plain",
          name: "plain",
          start: "/tailwind build\n".length,
          end: "/tailwind build\n/plain".length,
        },
      ],
      [
        {
          id: "/Users/workgyver/.agents/skills/tailwind",
          name: "tailwind",
          description: "Tailwind CSS guidance",
          body: "Use Tailwind skill body.",
        },
      ],
    );

    expect(
      expandSkills(text, skills, [
        {
          id: "/Users/workgyver/.agents/skills/tailwind",
          name: "tailwind",
          description: "Tailwind CSS guidance",
          body: "Use Tailwind skill body.",
        },
      ]),
    ).toBe("Use Tailwind skill body. build\n/plain text");
  });

  it("adds a tracked skill when inserted from the slash menu", () => {
    expect(
      applySkill(
        "/tai",
        { query: "tai", start: 0, end: 4 },
        { id: "tailwind", name: "tailwind" },
        [],
      ),
    ).toEqual({
      value: "/tailwind ",
      cursor: 10,
      skills: [
        {
          id: "tailwind",
          name: "tailwind",
          start: 0,
          end: 9,
        },
      ],
    });
  });
});
