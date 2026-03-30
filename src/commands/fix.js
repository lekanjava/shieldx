import fs from "fs";
import path from "path";
import chalk from "chalk";
import inquirer from "inquirer";
import { getFindings } from "./scan.js";

/**
 * Interactively or automatically moves hardcoded secrets to a .env file
 * and replaces them in the source code with environment variable calls.
 */
export default async function fix(dir, options = {}) {
  try {
    console.log(chalk.bold.blue("\n🔧 ShieldX Auto-Fix\n"));
    console.log(chalk.blue(`🔍 Scanning ${dir} for hardcoded secrets...\n`));

    const { findings } = getFindings(dir, options);

    if (findings.length === 0) {
      console.log(chalk.green("✅ No hardcoded secrets found!"));
      if (process.env.NODE_ENV !== "test") {
        process.exit(0);
      }
      return;
    }

    console.log(
      chalk.yellow(`⚠️  Found ${findings.length} potential secret(s)\n`)
    );

    let toFix = [];
    if (!options.auto) {
      const { selectedFindings } = await inquirer.prompt([
        {
          type: "checkbox",
          name: "selectedFindings",
          message: "Select secrets to move to .env:",
          choices: findings.map((f, idx) => ({
            name: `${chalk.red(f.type)} in ${chalk.gray(
              path.basename(f.file)
            )}:${f.line} - ${f.content.substring(0, 40)}...`,
            value: idx,
            checked: f.severity === "critical" || f.severity === "high",
          })),
        },
      ]);

      if (!selectedFindings || selectedFindings.length === 0) {
        console.log(chalk.gray("\nNo secrets selected. Exiting."));
        if (process.env.NODE_ENV !== "test") {
          process.exit(0);
        }
        return;
      }
      toFix = selectedFindings.map((idx) => findings[idx]);
    } else {
      // Auto mode - fix all critical and high severity
      toFix = findings.filter(
        (f) => f.severity === "critical" || f.severity === "high"
      );
      if (toFix.length === 0) {
        console.log(chalk.gray("No critical or high severity secrets to auto-fix."));
        if (process.env.NODE_ENV !== "test") {
          process.exit(0);
        }
        return;
      }
      console.log(chalk.blue(`\n🔧 Auto-fixing ${toFix.length} secrets...\n`));
    }

    await processFindings(toFix, options);

    console.log(chalk.bold.green("\n✨ Fix operation complete!"));
    console.log(chalk.cyan("\nNext steps:"));
    console.log(chalk.gray("  1. Review the changes in your source files"));
    console.log(chalk.gray("  2. Verify the new variables in your .env file"));
    console.log(chalk.gray("  3. Run 'shieldx scan .' to confirm all secrets are moved\n"));

    if (process.env.NODE_ENV !== "test") {
      process.exit(0);
    }
  } catch (err) {
    console.error(chalk.red(`❌ Error: ${err.message}`));
    if (process.env.NODE_ENV !== "test") {
      process.exit(1);
    }
  }
}

/**
 * Processes the selected findings: replaces code and updates .env
 */
async function processFindings(findings, options) {
  const envFile = options.envFile || ".env";
  const envVars = {};
  const dryRun = options.dryRun || false;

  for (const finding of findings) {
    const varName = generateVarName(finding);
    const value = extractValue(finding.content);

    if (!value) {
      console.log(chalk.gray(`   ⏩ Skipping ${path.basename(finding.file)}:${finding.line} (could not extract value)`));
      continue;
    }

    envVars[varName] = value;

    if (!dryRun) {
      replaceSecretInFile(finding, varName);
      console.log(
        chalk.green(`   ✅ Replaced with ${chalk.bold("process.env." + varName)} in ${path.basename(finding.file)}:${finding.line}`)
      );
    } else {
      console.log(
        chalk.blue(`   [DRY RUN] Would replace secret with ${varName} in ${finding.file}:${finding.line}`)
      );
    }
  }

  // Update the .env file
  if (!dryRun && Object.keys(envVars).length > 0) {
    let envContent = "";
    
    // Ensure .env exists
    if (!fs.existsSync(envFile)) {
      envContent = "# Created by ShieldX Auto-Fix\n";
    } else {
      envContent = fs.readFileSync(envFile, "utf-8");
      if (envContent && !envContent.endsWith("\n")) envContent += "\n";
    }

    const newVars = Object.entries(envVars)
      .map(([key, val]) => `${key}="${val}"`)
      .join("\n");

    const stamp = `\n# --- Added by ShieldX on ${new Date().toLocaleDateString()} ---\n`;
    fs.appendFileSync(envFile, stamp + newVars + "\n");
    
    console.log(
      chalk.bold.green(`\n✅ Successfully added ${Object.keys(envVars).length} variable(s) to ${envFile}\n`)
    );
  }
}

/**
 * Attempts to generate a meaningful variable name from the finding context
 */
function generateVarName(finding) {
  // Case 1: Detect existing process.env fallback (e.g., process.env.MONGO_URI || 'mongodb://...')
  const fallbackMatch = finding.content.match(/process\.env\.([A-Z0-9_]+)\s*(?:\|\||\?\?)\s*['"]/i);
  if (fallbackMatch && fallbackMatch[1]) {
    return fallbackMatch[1].toUpperCase();
  }

  // Case 2: Try to find an existing constant/variable name in the code line
  // Matches: const API_KEY = "...", let secret = "...", key: "..."
  const varMatch = finding.content.match(/(?:const|let|var|export|readonly)\s+([A-Z0-9_]+)\s*[:=]/i) ||
                   finding.content.match(/['"]?([A-Z0-9_]+)['"]?\s*:\s*['"]/i);
                   
  if (varMatch && varMatch[1] && varMatch[1].length > 2) {
    const candidate = varMatch[1].toUpperCase();
    return candidate;
  }

  // Fallback: Clean based finding type + short random hash
  const baseType = finding.type.replace(/\s+/g, "_").toUpperCase();
  const hash = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${baseType}_${hash}`;
}

/**
 * Extracts the quoted value from a string
 */
function extractValue(content) {
  // Matches content between single or double quotes
  const match = content.match(/['"]((?:\\.|[^'"])+)['"]/);
  return match ? match[1] : null;
}

/**
 * Performs the actual string replacement in the source file
 */
function replaceSecretInFile(finding, varName) {
  const content = fs.readFileSync(finding.file, "utf-8");
  const lines = content.split("\n");
  const lineIndex = finding.line - 1;
  const originalLine = lines[lineIndex];

  if (originalLine) {
    const ext = path.extname(finding.file).toLowerCase();
    
    // Default replacement (JS/TS pattern)
    let replacement = `process.env.${varName}`;
    
    // Language specific replacements
    if (ext === '.py') {
      replacement = `os.environ.get("${varName}")`;
    } else if (ext === '.php') {
      replacement = `getenv("${varName}")`;
    } else if (ext === '.go') {
      replacement = `os.Getenv("${varName}")`;
    }

    // Special Case: Detect if the secret is part of a fallback pattern like process.env.VAR || "secret"
    // In this case, we replace the ENTIRE expression with just process.env.VAR
    const fallbackRegex = new RegExp(`process\\.env\\.${varName}\\s*(?:\\|\\||\\?\\?)\\s*['"]([^'"]+)['"]`, 'i');
    let newLine;
    
    if (fallbackRegex.test(originalLine)) {
      newLine = originalLine.replace(fallbackRegex, `process.env.${varName}`);
    } else {
      // Standard replacement of just the quoted string
      newLine = originalLine.replace(/['"]([^'"]+)['"]/, replacement);
    }

    lines[lineIndex] = newLine;
    
    fs.writeFileSync(finding.file, lines.join("\n"));
  }
}
