import fs from "fs";
import path from "path";
import chalk from "chalk";
import ora from "ora";
import { getFindings } from "./scan.js";
import { parseEnv } from "../utils/parseEnv.js";

// ─── Box-drawing helpers ───────────────────────────────────────────────
const BOX = {
  tl: "╭", tr: "╮", bl: "╰", br: "╯",
  h: "─", v: "│",
  ltee: "├", rtee: "┤",
};

function boxLine(width) {
  return BOX.h.repeat(width);
}

function boxTop(width) {
  return chalk.gray(`${BOX.tl}${boxLine(width)}${BOX.tr}`);
}

function boxBottom(width) {
  return chalk.gray(`${BOX.bl}${boxLine(width)}${BOX.br}`);
}

function boxDivider(width) {
  return chalk.gray(`${BOX.ltee}${boxLine(width)}${BOX.rtee}`);
}

function boxRow(content, width) {
  // Strip ANSI to measure real length
  const stripped = content.replace(
    // eslint-disable-next-line no-control-regex
    /\x1b\[[0-9;]*m/g,
    ""
  );
  const padding = Math.max(0, width - stripped.length);
  return chalk.gray(BOX.v) + content + " ".repeat(padding) + chalk.gray(BOX.v);
}

// ─── Score bar renderer ────────────────────────────────────────────────
function renderScoreBar(score, barWidth = 30) {
  const filled = Math.round((score / 100) * barWidth);
  const empty = barWidth - filled;

  let barColor;
  if (score >= 80) barColor = chalk.green;
  else if (score >= 50) barColor = chalk.yellow;
  else barColor = chalk.red;

  const filledChar = "█";
  const emptyChar = chalk.gray("░");

  return barColor(filledChar.repeat(filled)) + emptyChar.repeat(empty);
}

function getGrade(score) {
  if (score >= 90) return { letter: "A+", color: chalk.bold.green };
  if (score >= 80) return { letter: "A", color: chalk.bold.green };
  if (score >= 70) return { letter: "B", color: chalk.bold.greenBright };
  if (score >= 60) return { letter: "C", color: chalk.bold.yellow };
  if (score >= 50) return { letter: "D", color: chalk.bold.hex("#FFA500") };
  return { letter: "F", color: chalk.bold.red };
}

function getStatusLabel(score) {
  if (score >= 90) return chalk.bold.green("EXCELLENT");
  if (score >= 80) return chalk.bold.green("GOOD");
  if (score >= 60) return chalk.bold.yellow("NEEDS ATTENTION");
  if (score >= 40) return chalk.bold.hex("#FFA500")("AT RISK");
  return chalk.bold.red("CRITICAL");
}

// ─── Individual checks ────────────────────────────────────────────────

function checkGitignore() {
  const result = { name: "Gitignore Safety", icon: "🔒" };
  const gitignorePath = ".gitignore";

  if (!fs.existsSync(gitignorePath)) {
    return { ...result, status: "fail", detail: "No .gitignore file found", points: 0 };
  }

  const content = fs.readFileSync(gitignorePath, "utf-8");
  const hasEnv = content.split("\n").some((line) => {
    const trimmed = line.trim();
    return trimmed === ".env" || trimmed === ".env*" || trimmed === ".env.*";
  });

  if (hasEnv) {
    return { ...result, status: "pass", detail: ".env is protected in .gitignore", points: 20 };
  }
  return { ...result, status: "fail", detail: ".env is NOT in .gitignore — secrets at risk!", points: 0 };
}

function checkEnvFilesExist() {
  const result = { name: "Env Files Exist", icon: "📄" };
  const hasEnv = fs.existsSync(".env");
  const hasExample = fs.existsSync(".env.example");

  if (hasEnv && hasExample) {
    return { ...result, status: "pass", detail: ".env and .env.example both present", points: 15 };
  }
  if (hasEnv && !hasExample) {
    return { ...result, status: "warn", detail: "Missing .env.example — run 'shieldx generate .env'", points: 8 };
  }
  if (!hasEnv && hasExample) {
    return { ...result, status: "warn", detail: "Missing .env — copy from .env.example", points: 5 };
  }
  return { ...result, status: "fail", detail: "No .env or .env.example found", points: 0 };
}

function checkEnvSync() {
  const result = { name: "Env Sync", icon: "🔄" };

  if (!fs.existsSync(".env") || !fs.existsSync(".env.example")) {
    return { ...result, status: "skip", detail: "Skipped — missing .env or .env.example", points: 0 };
  }

  try {
    const env = parseEnv(".env");
    const example = parseEnv(".env.example");

    const envKeys = new Set(Object.keys(env));
    const exampleKeys = new Set(Object.keys(example));

    const missingInExample = [...envKeys].filter((k) => !exampleKeys.has(k));
    const missingInEnv = [...exampleKeys].filter((k) => !envKeys.has(k));

    const total = missingInExample.length + missingInEnv.length;

    if (total === 0) {
      return { ...result, status: "pass", detail: "Files are perfectly in sync", points: 20 };
    }

    const parts = [];
    if (missingInExample.length > 0) parts.push(`${missingInExample.length} key(s) not in .env.example`);
    if (missingInEnv.length > 0) parts.push(`${missingInEnv.length} key(s) not in .env`);

    return {
      ...result,
      status: total > 3 ? "fail" : "warn",
      detail: parts.join(", "),
      points: Math.max(0, 20 - total * 4),
      extra: { missingInExample, missingInEnv },
    };
  } catch {
    return { ...result, status: "fail", detail: "Could not parse env files", points: 0 };
  }
}

function checkSecrets(scanDir) {
  const result = { name: "Secret Scan", icon: "🛡️" };

  try {
    const { findings, files, severityCounts, issuesFound } = getFindings(scanDir, {});

    if (issuesFound === 0) {
      return {
        ...result,
        status: "pass",
        detail: `${files.length} files scanned — no secrets found`,
        points: 30,
        extra: { filesScanned: files.length },
      };
    }

    const summary = [];
    if (severityCounts.critical > 0) summary.push(`${severityCounts.critical} critical`);
    if (severityCounts.high > 0) summary.push(`${severityCounts.high} high`);
    if (severityCounts.medium > 0) summary.push(`${severityCounts.medium} medium`);
    if (severityCounts.low > 0) summary.push(`${severityCounts.low} low`);

    const deductions = (severityCounts.critical * 15) + (severityCounts.high * 8) + (severityCounts.medium * 3) + (severityCounts.low * 1);

    return {
      ...result,
      status: severityCounts.critical > 0 || severityCounts.high > 0 ? "fail" : "warn",
      detail: `${issuesFound} issue(s) found (${summary.join(", ")})`,
      points: Math.max(0, 30 - deductions),
      extra: { findings, filesScanned: files.length, severityCounts, issuesFound },
    };
  } catch (err) {
    return { ...result, status: "fail", detail: `Scan error: ${err.message}`, points: 0 };
  }
}

function checkEmptyValues() {
  const result = { name: "Empty Values", icon: "📋" };

  if (!fs.existsSync(".env")) {
    return { ...result, status: "skip", detail: "Skipped — no .env file", points: 0 };
  }

  try {
    const env = parseEnv(".env");
    const keys = Object.keys(env);
    const emptyKeys = keys.filter((k) => {
      const val = env[k].replace(/['"]/g, "").trim();
      return val === "" || val === "your_value_here" || val === "changeme" || val === "TODO";
    });

    if (emptyKeys.length === 0) {
      return { ...result, status: "pass", detail: `All ${keys.length} variables have values`, points: 15 };
    }

    return {
      ...result,
      status: "warn",
      detail: `${emptyKeys.length} variable(s) have no value set`,
      points: Math.max(0, 15 - emptyKeys.length * 3),
      extra: { emptyKeys },
    };
  } catch {
    return { ...result, status: "fail", detail: "Could not parse .env file", points: 0 };
  }
}

// ─── Main audit command ────────────────────────────────────────────────

export default async function audit(options = {}) {
  const scanDir = options.dir || ".";
  const envFile = options.envFile || ".env";
  const strict = options.strict || false;

  // Animated header
  if (!options.json) {
    console.log();
    console.log(chalk.bold.cyan("  ╔══════════════════════════════════════╗"));
    console.log(chalk.bold.cyan("  ║") + chalk.bold("   🛡️  ShieldX Security Audit          ") + chalk.bold.cyan("║"));
    console.log(chalk.bold.cyan("  ╚══════════════════════════════════════╝"));
    console.log();
  }

  // Run checks with spinner
  const spinner = !options.json ? ora({ text: "Running security checks...", spinner: "dots12", color: "cyan" }).start() : null;

  const checks = [];

  // Check 1: Gitignore
  if (spinner) spinner.text = "Checking .gitignore safety...";
  checks.push(checkGitignore());

  // Check 2: Env files exist
  if (spinner) spinner.text = "Checking env files...";
  checks.push(checkEnvFilesExist());

  // Check 3: Env sync
  if (spinner) spinner.text = "Comparing env files...";
  checks.push(checkEnvSync());

  // Check 4: Secret scan
  if (spinner) spinner.text = "Scanning for hardcoded secrets...";
  checks.push(checkSecrets(scanDir));

  // Check 5: Empty values
  if (spinner) spinner.text = "Checking for empty values...";
  checks.push(checkEmptyValues());

  if (spinner) spinner.stop();

  // Calculate score
  const maxPoints = 100; // 20 + 15 + 20 + 30 + 15
  const earnedPoints = checks.reduce((sum, c) => sum + c.points, 0);
  const score = Math.round((earnedPoints / maxPoints) * 100);
  const grade = getGrade(score);

  // ─── JSON output ──────────────────────────────────────────────────
  if (options.json) {
    const output = {
      version: "2.2.0",
      timestamp: new Date().toISOString(),
      scanDirectory: scanDir,
      score,
      grade: grade.letter,
      status: score >= 80 ? "pass" : score >= 50 ? "warn" : "fail",
      checks: checks.map((c) => ({
        name: c.name,
        status: c.status,
        detail: c.detail,
        points: c.points,
        ...(c.extra || {}),
      })),
    };
    console.log(JSON.stringify(output, null, 2));
    const exitCode = strict ? (score < 100 ? 1 : 0) : (score < 50 ? 1 : 0);
    if (process.env.NODE_ENV !== "test") process.exit(exitCode);
    return output;
  }

  // ─── Modern visual output ─────────────────────────────────────────
  const W = 56; // inner width

  console.log(boxTop(W));
  console.log(boxRow(chalk.bold("  CHECK RESULTS"), W));
  console.log(boxDivider(W));

  for (const check of checks) {
    let statusIcon, statusStr;
    switch (check.status) {
      case "pass":
        statusIcon = chalk.green("●");
        statusStr = chalk.bold.green("PASS");
        break;
      case "warn":
        statusIcon = chalk.yellow("●");
        statusStr = chalk.bold.yellow("WARN");
        break;
      case "fail":
        statusIcon = chalk.red("●");
        statusStr = chalk.bold.red("FAIL");
        break;
      case "skip":
        statusIcon = chalk.gray("○");
        statusStr = chalk.gray("SKIP");
        break;
    }

    const label = ` ${statusIcon} ${statusStr}  ${check.icon} ${chalk.bold(check.name)}`;
    console.log(boxRow(label, W));
    console.log(boxRow(chalk.gray(`         ${check.detail}`), W));
    console.log(boxRow("", W));
  }

  console.log(boxDivider(W));

  // Score section
  console.log(boxRow("", W));
  console.log(boxRow(chalk.bold("  SECURITY SCORE"), W));
  console.log(boxRow("", W));
  console.log(boxRow(`  ${renderScoreBar(score)}  ${grade.color(grade.letter)} ${chalk.bold(score + "/100")}`, W));
  console.log(boxRow(`  ${getStatusLabel(score)}`, W));
  console.log(boxRow("", W));
  console.log(boxBottom(W));

  // ─── Actionable suggestions ───────────────────────────────────────
  const suggestions = [];

  const secretCheck = checks.find((c) => c.name === "Secret Scan");
  if (secretCheck && secretCheck.status !== "pass") {
    suggestions.push(`Run ${chalk.cyan("shieldx fix " + scanDir)} to auto-fix hardcoded secrets`);
  }

  const syncCheck = checks.find((c) => c.name === "Env Sync");
  if (syncCheck && syncCheck.status !== "pass" && syncCheck.status !== "skip") {
    suggestions.push(`Run ${chalk.cyan("shieldx generate .env")} to sync .env.example`);
  }

  const gitCheck = checks.find((c) => c.name === "Gitignore Safety");
  if (gitCheck && gitCheck.status === "fail") {
    suggestions.push(`Run ${chalk.cyan("shieldx init")} to set up .gitignore protection`);
  }

  const emptyCheck = checks.find((c) => c.name === "Empty Values");
  if (emptyCheck && emptyCheck.extra && emptyCheck.extra.emptyKeys) {
    const keys = emptyCheck.extra.emptyKeys.slice(0, 3).join(", ");
    const more = emptyCheck.extra.emptyKeys.length > 3 ? ` (+${emptyCheck.extra.emptyKeys.length - 3} more)` : "";
    suggestions.push(`Fill in empty values: ${chalk.yellow(keys)}${more}`);
  }

  if (suggestions.length > 0) {
    console.log();
    console.log(chalk.bold.cyan("  💡 Recommendations"));
    console.log(chalk.gray("  " + "─".repeat(40)));
    suggestions.forEach((s, i) => {
      console.log(chalk.white(`  ${i + 1}. ${s}`));
    });
  }

  if (score >= 90) {
    console.log();
    console.log(chalk.green("  🎉 Your project security is excellent!"));
  }

  console.log();

  // Exit code
  const hasCritical = checks.some((c) => c.status === "fail");
  const hasWarnings = checks.some((c) => c.status === "warn");
  const exitCode = strict ? (hasCritical || hasWarnings ? 1 : 0) : (hasCritical ? 1 : 0);

  if (process.env.NODE_ENV !== "test") {
    process.exit(exitCode);
  }

  return { score, grade: grade.letter, checks };
}
