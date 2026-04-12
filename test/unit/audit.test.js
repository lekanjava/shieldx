import { describe, it, expect, beforeAll, afterAll, jest, beforeEach } from "@jest/globals";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDir = path.join(__dirname, "../temp_audit_test");

// Store original cwd and override it for tests
const originalCwd = process.cwd;

describe("audit command", () => {
  beforeAll(() => {
    process.env.NODE_ENV = "test";

    // Create temp directory structure
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Create src directory with a secret
    const srcDir = path.join(testDir, "src");
    if (!fs.existsSync(srcDir)) {
      fs.mkdirSync(srcDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(srcDir, "app.js"),
      `const key = "sk_live_12345678901234567890";\n`
    );

    // Create .env
    fs.writeFileSync(
      path.join(testDir, ".env"),
      "DATABASE_URL=postgres://localhost/db\nAPI_KEY=my-secret-key\nEMPTY_VAR=\n"
    );

    // Create .env.example
    fs.writeFileSync(
      path.join(testDir, ".env.example"),
      "DATABASE_URL=\nAPI_KEY=\n"
    );

    // Create .gitignore with .env
    fs.writeFileSync(
      path.join(testDir, ".gitignore"),
      "node_modules/\n.env\n"
    );
  });

  afterAll(() => {
    process.cwd = originalCwd;
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Override cwd to our test directory
    process.cwd = () => testDir;
  });

  it("should run all checks and return a result object", async () => {
    // Dynamic import to ensure clean module state
    const { default: audit } = await import("../../src/commands/audit.js");

    // Change to testDir so fs checks find our fixtures
    const savedDir = process.cwd();
    process.chdir(testDir);

    try {
      const result = await audit({ json: true, dir: path.join(testDir, "src") });

      expect(result).toBeDefined();
      expect(typeof result.score).toBe("number");
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.grade).toBeDefined();
      expect(result.checks).toBeInstanceOf(Array);
      expect(result.checks).toHaveLength(5);
    } finally {
      process.chdir(savedDir);
    }
  });

  it("should detect .gitignore safety", async () => {
    const { default: audit } = await import("../../src/commands/audit.js");
    const savedDir = process.cwd();
    process.chdir(testDir);

    try {
      const result = await audit({ json: true, dir: path.join(testDir, "src") });
      const gitCheck = result.checks.find((c) => c.name === "Gitignore Safety");

      expect(gitCheck).toBeDefined();
      expect(gitCheck.status).toBe("pass");
    } finally {
      process.chdir(savedDir);
    }
  });

  it("should detect env file existence", async () => {
    const { default: audit } = await import("../../src/commands/audit.js");
    const savedDir = process.cwd();
    process.chdir(testDir);

    try {
      const result = await audit({ json: true, dir: path.join(testDir, "src") });
      const fileCheck = result.checks.find((c) => c.name === "Env Files Exist");

      expect(fileCheck).toBeDefined();
      expect(fileCheck.status).toBe("pass");
    } finally {
      process.chdir(savedDir);
    }
  });

  it("should detect env sync drift", async () => {
    const { default: audit } = await import("../../src/commands/audit.js");
    const savedDir = process.cwd();
    process.chdir(testDir);

    try {
      const result = await audit({ json: true, dir: path.join(testDir, "src") });
      const syncCheck = result.checks.find((c) => c.name === "Env Sync");

      // EMPTY_VAR is in .env but not .env.example
      expect(syncCheck).toBeDefined();
      expect(syncCheck.status).toBe("warn");
    } finally {
      process.chdir(savedDir);
    }
  });

  it("should detect hardcoded secrets", async () => {
    const { default: audit } = await import("../../src/commands/audit.js");
    const savedDir = process.cwd();
    process.chdir(testDir);

    try {
      const result = await audit({ json: true, dir: path.join(testDir, "src") });
      const secretCheck = result.checks.find((c) => c.name === "Secret Scan");

      expect(secretCheck).toBeDefined();
      expect(secretCheck.status).toBe("fail");
      expect(secretCheck.issuesFound).toBeGreaterThan(0);
    } finally {
      process.chdir(savedDir);
    }
  });

  it("should detect empty env values", async () => {
    const { default: audit } = await import("../../src/commands/audit.js");
    const savedDir = process.cwd();
    process.chdir(testDir);

    try {
      const result = await audit({ json: true, dir: path.join(testDir, "src") });
      const emptyCheck = result.checks.find((c) => c.name === "Empty Values");

      expect(emptyCheck).toBeDefined();
      expect(emptyCheck.status).toBe("warn");
      expect(emptyCheck.emptyKeys).toContain("EMPTY_VAR");
    } finally {
      process.chdir(savedDir);
    }
  });

  it("should produce valid JSON output", async () => {
    const { default: audit } = await import("../../src/commands/audit.js");
    const savedDir = process.cwd();
    process.chdir(testDir);

    try {
      // Capture console.log output
      const logs = [];
      const originalLog = console.log;
      console.log = (...args) => logs.push(args.join(" "));

      await audit({ json: true, dir: path.join(testDir, "src") });

      console.log = originalLog;

      // The JSON output should be parseable
      const jsonStr = logs.join("\n");
      const parsed = JSON.parse(jsonStr);
      expect(parsed.version).toBe("2.2.0");
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.score).toBeDefined();
      expect(parsed.checks).toHaveLength(5);
    } finally {
      process.chdir(savedDir);
    }
  });

  it("should return perfect score when no issues exist", async () => {
    const { default: audit } = await import("../../src/commands/audit.js");

    // Create a clean directory with no issues
    const cleanDir = path.join(testDir, "clean_project");
    const cleanSrc = path.join(cleanDir, "src");
    fs.mkdirSync(cleanSrc, { recursive: true });
    fs.writeFileSync(path.join(cleanSrc, "index.js"), "console.log('hello');\n");
    fs.writeFileSync(path.join(cleanDir, ".env"), "PORT=3000\nNODE_ENV=development\n");
    fs.writeFileSync(path.join(cleanDir, ".env.example"), "PORT=\nNODE_ENV=\n");
    fs.writeFileSync(path.join(cleanDir, ".gitignore"), ".env\nnode_modules/\n");

    const savedDir = process.cwd();
    process.chdir(cleanDir);

    try {
      const result = await audit({ json: true, dir: cleanSrc });

      expect(result.score).toBe(100);
      expect(result.grade).toBe("A+");
      expect(result.checks.every((c) => c.status === "pass")).toBe(true);
    } finally {
      process.chdir(savedDir);
      fs.rmSync(cleanDir, { recursive: true, force: true });
    }
  });
});
