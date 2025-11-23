import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { execSync } from "node:child_process";
import { promisify } from "node:util";
import { exec } from "node:child_process";
import { logger } from "../common/utils/logger";
import { getCommitHistory } from "./git/commits";
import { applyRestack } from "./git/apply";
import type { RestackOperation } from "../common/types";

const execAsync = promisify(exec);

export type ServerConfig = {
  port: number;
  gitRoot: string;
};

export const createStackServer = async (config: ServerConfig) => {
  const app = new Hono();

  // Enable CORS for local development
  app.use("/*", cors());

  // Health check
  app.get("/api/health", (c) => {
    return c.json({ status: "ok", gitRoot: config.gitRoot });
  });

  // Get all branches
  app.get("/api/branches", (c) => {
    try {
      // Get all local branches
      const localBranches = execSync('git branch --format="%(refname:short)"', {
        cwd: config.gitRoot,
        encoding: "utf-8",
      })
        .trim()
        .split("\n")
        .filter(Boolean);

      // Get all remote branches
      const remoteBranches = execSync(
        'git branch -r --format="%(refname:short)"',
        {
          cwd: config.gitRoot,
          encoding: "utf-8",
        }
      )
        .trim()
        .split("\n")
        .filter(Boolean)
        .filter((b) => !b.includes("HEAD") && b.includes("/")); // Filter out HEAD and non-branch entries

      return c.json({
        local: localBranches,
        remote: remoteBranches,
        all: [...localBranches, ...remoteBranches],
      });
    } catch (error) {
      logger.error("Failed to get branches:", error);
      return c.json({ local: [], remote: [], all: [] }, 500);
    }
  });

  // Get branch info
  app.get("/api/branch", (c) => {
    try {
      const currentBranch = execSync("git rev-parse --abbrev-ref HEAD", {
        cwd: config.gitRoot,
        encoding: "utf-8",
      }).trim();

      // Try to find base branch
      const branches = ["origin/main", "origin/master", "main", "master"];
      let baseBranch = "main";
      for (const branch of branches) {
        try {
          execSync(`git rev-parse --verify ${branch}`, {
            cwd: config.gitRoot,
            stdio: "ignore",
          });
          baseBranch = branch;
          break;
        } catch {
          // Branch doesn't exist
        }
      }

      return c.json({ currentBranch, baseBranch });
    } catch (error) {
      logger.error("Failed to get branch info:", error);
      return c.json({ currentBranch: "unknown", baseBranch: "main" });
    }
  });

  // Get commit history with diffs
  app.get("/api/commits", async (c) => {
    try {
      const baseBranch = c.req.query("base"); // Optional base branch parameter
      const currentBranch = c.req.query("branch"); // Optional current branch parameter
      logger.debug(
        `Fetching commit history: ${baseBranch || "auto"} .. ${
          currentBranch || "HEAD"
        }`
      );
      const commits = await getCommitHistory(
        config.gitRoot,
        baseBranch,
        currentBranch
      );
      logger.debug(`Fetched ${commits.length} commits`);
      return c.json(commits);
    } catch (error) {
      logger.error("Failed to get commits:", error);
      const message =
        error instanceof Error ? error.message : "Failed to fetch commits";
      return c.json({ error: message }, 500);
    }
  });

  // Get full file content for a specific commit and file
  app.get("/api/file-content", async (c) => {
    try {
      const commitHash = c.req.query("commit");
      const filePath = c.req.query("file");

      if (!commitHash || !filePath) {
        return c.json({ error: "Missing commit or file parameter" }, 400);
      }

      logger.debug(`Fetching file content: ${commitHash}:${filePath}`);

      const { stdout: content } = await execAsync(
        `git show ${commitHash}:"${filePath}"`,
        { cwd: config.gitRoot, maxBuffer: 10 * 1024 * 1024 }
      );

      return c.json({ content });
    } catch (error) {
      logger.error("Failed to get file content:", error);
      const message =
        error instanceof Error ? error.message : "Failed to fetch file content";
      return c.json({ error: message }, 500);
    }
  });

  // Apply restack operations
  app.post("/api/restack", async (c) => {
    try {
      logger.info("Applying restack operations...");
      const operations: RestackOperation[] = await c.req.json();
      logger.debug(`Received ${operations.length} operations`);

      await applyRestack(config.gitRoot, operations);

      logger.info("Restack completed successfully!");
      return c.json({ success: true, message: "Restack completed" });
    } catch (error) {
      logger.error("Failed to apply restack:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to apply restack operations";
      return c.json({ error: message }, 500);
    }
  });

  // Serve React build
  app.use("/*", serveStatic({ root: "./src/stack/ui/dist" }));

  // Start server using Bun's native HTTP
  const server = Bun.serve({
    port: config.port,
    fetch: app.fetch,
  });

  logger.info(`Server started on port ${config.port}`);
  return server;
};
