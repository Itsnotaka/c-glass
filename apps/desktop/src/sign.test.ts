import { describe, expect, it } from "vitest";

import { parseSign } from "./sign";

describe("parseSign", () => {
  it("detects signed bundles from Authority lines", () => {
    expect(
      parseSign(`Executable=/Applications/Glass.app/Contents/MacOS/Glass
Identifier=com.glass.app
Authority=Developer ID Application: Glass Inc (ABCDE12345)
Authority=Developer ID Certification Authority
Authority=Apple Root CA`),
    ).toBe("signed");
  });

  it("detects ad-hoc signatures", () => {
    expect(
      parseSign(`Executable=/Applications/Glass.app/Contents/MacOS/Glass
Identifier=com.glass.app
Signature=adhoc`),
    ).toBe("adhoc");
  });

  it("detects unsigned binaries", () => {
    expect(parseSign("code object is not signed at all")).toBe("unsigned");
  });
});
