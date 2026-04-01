import { createReadStream, realpathSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, relative } from "node:path";

const port = Number(process.env.GLASS_DESKTOP_MOCK_UPDATE_SERVER_PORT ?? 3000);
const root =
  process.env.GLASS_DESKTOP_MOCK_UPDATE_SERVER_ROOT ??
  resolve(import.meta.dirname, "..", "release-mock");

const mockServerLog = (level: "info" | "warn" | "error" = "info", message: string) => {
  console[level](`[mock-update-server] ${message}`);
};

function isWithinRoot(filePath: string): boolean {
  try {
    return !relative(realpathSync(root), realpathSync(filePath)).startsWith(".");
  } catch (error) {
    mockServerLog("error", `Error checking if file is within root: ${error}`);
    return false;
  }
}

const server = createServer((req, res) => {
  void (async () => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const path = url.pathname;
    mockServerLog("info", `Request received for path: ${path}`);
    const filePath = resolve(root, `.${path}`);
    if (!isWithinRoot(filePath)) {
      mockServerLog("warn", `Attempted to access file outside of root: ${filePath}`);
      res.writeHead(404);
      res.end("Not Found");
      return;
    }
    try {
      const st = await stat(filePath);
      if (!st.isFile()) {
        mockServerLog("warn", `Attempted to access non-file: ${filePath}`);
        res.writeHead(404);
        res.end("Not Found");
        return;
      }
    } catch {
      mockServerLog("warn", `Attempted to access non-existent file: ${filePath}`);
      res.writeHead(404);
      res.end("Not Found");
      return;
    }
    mockServerLog("info", `Serving file: ${filePath}`);
    res.writeHead(200);
    createReadStream(filePath).pipe(res);
  })().catch((error) => {
    mockServerLog("error", String(error));
    if (!res.headersSent) res.writeHead(500);
    res.end("Internal Server Error");
  });
});

server.listen(port, "localhost", () => {
  mockServerLog("info", `running on http://localhost:${port}`);
});
