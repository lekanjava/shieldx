import { getFindings } from "../../src/commands/scan.js";
import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testDir = path.join(__dirname, "../temp_scan_test");

describe("scanCode / getFindings", () => {
  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Create test files with various secrets and false positives
    const content = `
      // Valid secrets
      const STRIPE_KEY = "sk_live_12345678901234567890";
      const dbUrl = "postgres://user:password@localhost:5432/db";
      const ghp = "ghp_123456789012345678901234567890123456";
      
      // False positives that should be ignored
      import DashboardHeader from "@/components/molecules/dashboard/DashboardHeader";
      const logo = "https://logo.clearbit.com/islamic-relief.org";
      const schema = "https://ui.shadcn.com/schema.json";
      
      // Long strings that should be ignored if < 50 chars
      const shortLong = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
      const actualLong = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"; // This should be caught as Long String
    `;
    fs.writeFileSync(path.join(testDir, "test.js"), content);
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("should detect real secrets and ignore known false positives", () => {
    const { findings, issuesFound } = getFindings(testDir);

    // Should find: Stripe Key, Database URL (via HTTP Credentials or separate DB pattern), GitHub Token, and the 60char Long String
    // Note: Database URL is caught by "Database URL" pattern while authUrl would be caught by "HTTP Credentials"
    
    const types = findings.map(f => f.type);
    
    expect(types).toContain("Stripe Live Key");
    expect(types).toContain("GitHub Token");
    expect(types).toContain("Database URL");
    expect(types).toContain("Long String");
    
    // Should NOT contain HTTP Credentials since the URLs in the test file don't have user:pass
    expect(types).not.toContain("HTTP Credentials");
    
    // Total should be around 4 (Stripe, DB, GitHub, Long String)
    expect(issuesFound).toBeGreaterThanOrEqual(4);
  });

  it("should respect .shieldxignore", () => {
    fs.writeFileSync(path.join(testDir, ".shieldxignore"), "test.js");
    const { findings, issuesFound } = getFindings(testDir);
    expect(issuesFound).toBe(0);
    fs.unlinkSync(path.join(testDir, ".shieldxignore"));
  });

  it("should respect .shieldxallow (whitelist)", () => {
    // Whitelist the Stripe key pattern
    fs.writeFileSync(path.join(testDir, ".shieldxallow"), "sk_live_");
    const { findings } = getFindings(testDir);
    const types = findings.map(f => f.type);
    expect(types).not.toContain("Stripe Live Key");
    fs.unlinkSync(path.join(testDir, ".shieldxallow"));
  });
});
