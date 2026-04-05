import { describe, expect, it } from "vitest";

import { buildPiRows } from "./pi-chat-timeline";

describe("buildPiRows", () => {
  it("extracts user file blocks and image blocks into attachments", () => {
    const rows = buildPiRows([
      {
        id: "u1",
        message: {
          role: "user-with-attachments",
          content: [
            {
              type: "text",
              text: 'Check both files\n<file name="/tmp/foo.ts">\nexport const foo = 1;\n</file>\n<file name="/tmp/shot.png"></file>',
            },
            {
              type: "image",
              mimeType: "image/png",
              data: "abc123",
            },
          ],
        },
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "user",
      text: "Check both files",
      attachments: [
        {
          kind: "image",
          name: "shot.png",
          path: "/tmp/shot.png",
          mimeType: "image/png",
          data: "abc123",
        },
        {
          kind: "file",
          name: "foo.ts",
          path: "/tmp/foo.ts",
          note: "export const foo = 1;",
        },
      ],
    });
  });

  it("emits assistantError for assistant errorMessage instead of merging into markdown", () => {
    const rows = buildPiRows([
      {
        id: "a1",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Partial reply." }],
          errorMessage: "Rate limit exceeded",
        },
      },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ kind: "assistant", text: "Partial reply." });
    expect(rows[1]).toMatchObject({
      kind: "assistantError",
      text: "Rate limit exceeded",
    });
  });
});
