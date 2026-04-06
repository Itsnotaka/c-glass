import * as Effect from "effect/Effect";
import {
  DefaultResourceLoader,
  SessionManager,
  createAgentSession,
  runRpcMode,
} from "@mariozechner/pi-coding-agent";
import { setCursorSessionCwd } from "../cursor-provider";
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

  const settings = cfg.settings(argv.cwd);
  const loader = new DefaultResourceLoader({
    cwd: argv.cwd,
    agentDir: cfg.paths(argv.cwd).agent,
    settingsManager: settings,
  });
  await loader.reload();

  const mgr = argv.session ? SessionManager.open(argv.session) : SessionManager.create(argv.cwd);
  const out = await createAgentSession({
    cwd: argv.cwd,
    authStorage: cfg.auth,
    modelRegistry: cfg.reg,
    resourceLoader: loader,
    sessionManager: mgr,
    settingsManager: settings,
  });

  setCursorSessionCwd(out.session.sessionId, out.session.sessionManager.getCwd());
  await runRpcMode(out.session);
}

void run().catch((err) => {
  const text = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
  process.stderr.write(`${text}\n`);
  process.exit(1);
});
