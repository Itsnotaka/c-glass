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
});
