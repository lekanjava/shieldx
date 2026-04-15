import fs from "fs";
import path from "path";
import chalk from "chalk";

const TOP_PACKAGES = [
  "express", "react", "react-dom", "lodash", "moment", "chalk", "commander", 
  "inquirer", "axios", "mongoose", "tailwindcss", "typescript", "jest", 
  "webpack", "eslint", "prettier", "dotenv", "next", "vue", "angular",
  "cross-env", "body-parser", "uuid", "crypto-js", "fs-extra", "uuid",
  "request", "node-fetch", "underscore"
];

const KNOWN_MALICIOUS = {
  "crossenv": "Typosquatting of 'cross-env'. Contains malicious payload.",
  "eslint-scope-5": "Typosquat/Malicious version.",
  "flatmap-stream": "Injected malicious code targeting bitcoin wallets.",
  "event-stream-3.3.6": "Compromised version of event-stream.",
  "rc-all": "Malicious typosquat.",
  "buble": "Deprecated/Vulnerable if certain old versions.",
  "request": "Deprecated. Use 'axios' or 'node-fetch' instead.",
  "electorn": "Typosquatting of 'electron'. Malicious."
};

/**
 * Very simple Levenshtein distance
 */
function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export function scanDeps(dir = ".", options = {}) {
  try {
    const pkgPath = path.join(dir, "package.json");
    
    if (!fs.existsSync(pkgPath)) {
      console.error(chalk.red(`❌ Error: Could not find package.json in ${dir}`));
      process.exit(1);
    }

    if (!options.quiet && !options.json) {
      console.log(chalk.blue(`📦 Scanning dependencies in ${pkgPath}...\n`));
    }

    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const depsObj = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const depsKeys = Object.keys(depsObj);
    
    let issuesFound = 0;
    const findings = [];
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };

    depsKeys.forEach(dep => {
      // 1. Check against known malicious
      if (KNOWN_MALICIOUS[dep]) {
        issuesFound++;
        severityCounts.critical++;
        findings.push({
          package: dep,
          version: depsObj[dep],
          type: "Malicious/Deprecated Package",
          severity: "critical",
          message: KNOWN_MALICIOUS[dep]
        });
        return; // skip further checks for this
      }

      // 2. Check for Typosquatting against top packages
      // only check if dep is NOT exactly in the top packages 
      // (if it IS in TOP_PACKAGES, it's the real one)
      if (!TOP_PACKAGES.includes(dep)) {
        for (const top of TOP_PACKAGES) {
          const dist = levenshteinDistance(dep.toLowerCase(), top.toLowerCase());
          
          // If distance is 1, or distance is 2 but it's a long package name
          if (dist === 1 || (dist === 2 && top.length > 6)) {
            // It looks suspicious!
            issuesFound++;
            severityCounts.high++;
            findings.push({
              package: dep,
              version: depsObj[dep],
              type: "Potential Typosquatting",
              severity: "high",
              message: `Looks very similar to popular package '${top}'. Please verify this is intentional.`
            });
            break; // Stop checking against other top packages once flagged
          }
        }
      }
    });

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            scannedFile: pkgPath,
            packagesScanned: depsKeys.length,
            issuesFound,
            severityCounts,
            findings,
          },
          null,
          2
        )
      );
      return;
    }

    if (issuesFound === 0) {
      console.log(chalk.green("✅ No malicious or suspicious dependencies found! 🎉"));
      console.log(chalk.gray(`   Scanned ${depsKeys.length} packages`));
    } else {
      findings.forEach((finding) => {
        if (!options.quiet) {
          const severityColor = {
            critical: chalk.bgRed.white.bold,
            high: chalk.red,
            medium: chalk.yellow,
            low: chalk.blue,
          };

          console.log(
            severityColor[finding.severity](
              `🚨 [${finding.severity.toUpperCase()}] ${finding.type}`
            ) + chalk.gray(` in package.json`)
          );
          console.log(chalk.yellow(`    Package: ${finding.package}@${finding.version}`));
          console.log(chalk.white(`    ${finding.message}\n`));
        }
      });

      console.log(chalk.red.bold(`\n⚠️  Dependency Security Report:`));
      console.log(chalk.red(`   Total issues: ${issuesFound}`));
      console.log(chalk.gray(`   Packages scanned: ${depsKeys.length}`));
      console.log();
      if (severityCounts.critical > 0)
        console.log(chalk.bgRed.white(` CRITICAL: ${severityCounts.critical} `));
      if (severityCounts.high > 0)
        console.log(chalk.red(`   High: ${severityCounts.high}`));
      if (severityCounts.medium > 0)
        console.log(chalk.yellow(`   Medium: ${severityCounts.medium}`));
      if (severityCounts.low > 0)
        console.log(chalk.blue(`   Low: ${severityCounts.low}`));
    }

    if (process.env.NODE_ENV !== "test") {
      process.exit(issuesFound > 0 ? 1 : 0);
    }
  } catch (err) {
    console.error(chalk.red(`❌ Error: ${err.message}`));
    if (process.env.NODE_ENV !== "test") {
      process.exit(1);
    }
  }
}
