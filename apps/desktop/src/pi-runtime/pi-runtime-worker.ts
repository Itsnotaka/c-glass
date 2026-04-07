import * as Effect from "effect/Effect";
import { setCursorSessionCwd } from "../cursor-provider";
import { loadPi } from "../pi-imports";
import { PiConfigService } from "../pi-config-service";

function readArg(args: string[], key: string) {
  const i = args.indexOf(key);
  if (i < 0) return null;
  const next = args[i + 1];
  if (!next || next.startsWith("--")) {
    throw new Error(`Missing value for ${key}`);
  }
  return next;
}

function parseArgv(args: string[]) {
  const cwd = readArg(args, "--cwd") ?? process.cwd();
  const session = readArg(args, "--session");
  return { cwd, session };
}

async function run() {
  const argv = parseArgv(process.argv.slice(2));
  const cfg = new PiConfigService();
  await Effect.runPromise(cfg.prepare(argv.cwd));

  const pi = await loadPi();
  const settings = cfg.settings(argv.cwd);
  const loader = new pi.DefaultResourceLoader({
    cwd: argv.cwd,
    agentDir: cfg.paths(argv.cwd).agent,
    settingsManager: settings,
  });
  await loader.reload();

  const mgr = argv.session
    ? pi.SessionManager.open(argv.session)
    : pi.SessionManager.create(argv.cwd);
  const out = await pi.createAgentSession({
    cwd: argv.cwd,
    authStorage: cfg.auth,
    modelRegistry: cfg.reg,
    resourceLoader: loader,
    sessionManager: mgr,
    settingsManager: settings,
  });

  setCursorSessionCwd(out.session.sessionId, out.session.sessionManager.getCwd());
  await pi.runRpcMode(out.session);
}

void run().catch((err) => {
  const text = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
  process.stderr.write(`${text}\n`);
  process.exit(1);
});
