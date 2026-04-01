import * as ChildProcess from "node:child_process";

export type Sign = "signed" | "adhoc" | "unsigned";

export function parseSign(raw: string): Sign {
  if (/^Authority=/m.test(raw)) {
    return "signed";
  }
  if (/^Signature=adhoc$/m.test(raw)) {
    return "adhoc";
  }
  if (raw.toLowerCase().includes("not signed")) {
    return "unsigned";
  }
  return "unsigned";
}

export function probeSign(file: string): Sign {
  const out = ChildProcess.spawnSync("codesign", ["-dv", "--verbose=4", file], {
    encoding: "utf8",
  });
  if (out.error) {
    return "unsigned";
  }
  return parseSign(`${out.stdout ?? ""}\n${out.stderr ?? ""}`);
}
