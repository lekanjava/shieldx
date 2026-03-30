import fs from "fs";
import path from "path";
import chalk from "chalk";
import ora from "ora";

const SECRET_PATTERNS = [
  {
    name: "Stripe Live Key",
    pattern: /sk_live_[0-9a-zA-Z]{20,}/,
    severity: "high",
  },
  {
    name: "Stripe Test Key",
    pattern: /sk_test_[0-9a-zA-Z]{20,}/,
    severity: "medium",
  },
  {
    name: "Google API Key",
    pattern: /AIza[0-9A-Za-z\-_]{35}/,
    severity: "high",
  },
  { name: "GitHub Token", pattern: /ghp_[0-9a-zA-Z]{36}/, severity: "high" },
  {
    name: "Password",
    pattern: /\b(password|pass|passwd)\s*[:=]\s*['"]([^'"]+)['"]/i,
    severity: "high",
  },
  {
    name: "Secret",
    pattern: /\b(secret|token|key|auth)\s*[:=]\s*['"]([^'"]+)['"]/i,
    severity: "high",
  },
  {
    name: "Long String",
    pattern: /['"][A-Za-z0-9\-_]{50,}['"]/,
    severity: "low",
  },
  {
    name: "Database URL",
    pattern: /(mongodb|postgres|postgresql|mysql|redis|amqp|mssql|sqlite|oracle):\/\/[^\s'"]+/i,
    severity: "high",
  },
  {
    name: "HTTP Credentials",
    pattern: /https?:\/\/[^/:\s'"]+:[^/:\s'"]+@[^\s'"]+/i,
    severity: "high",
  },
  {
    name: "Cloud Storage URL",
    pattern: /(s3|gs|azure):\/\/[^\s'"]+/i,
    severity: "medium",
  },
  {
    name: "Private IP",
    pattern: /http:\/\/(10|172\.(1[6-9]|2[0-9]|3[0-1])|192\.168)\.[0-9\.]+/i,
    severity: "medium",
  },
  {
    name: "Bearer Token",
    pattern: /Bearer\s+[0-9a-zA-Z\-_\.]+/i,
    severity: "high",
  },
  { name: "AWS Access Key", pattern: /AKIA[0-9A-Z]{16}/, severity: "high" },
  {
    name: "Base64 String",
    pattern: /[a-zA-Z0-9+\/]{64,}={0,2}/,
    severity: "low",
  },
  {
    name: "Slack Token",
    pattern: /xox[baprs]-[0-9a-zA-Z-]+/,
    severity: "high",
  },
  {
    name: "Facebook Token",
    pattern: /EAACEdEose0cBA[0-9A-Za-z]+/,
    severity: "high",
  },
  { name: "Google OAuth", pattern: /ya29\.[0-9A-Za-z\-_]+/, severity: "high" },
  {
    name: "JWT Token",
    pattern: /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/,
    severity: "medium",
  },
  {
    name: "Private Key Header",
    pattern: /-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----/,
    severity: "critical",
  },
  {
    name: "Private Key",
    pattern: /-----BEGIN PRIVATE KEY-----/,
    severity: "critical",
  },
  {
    name: "Encrypted Private Key",
    pattern: /-----BEGIN ENCRYPTED PRIVATE KEY-----/,
    severity: "critical",
  },
  {
    name: "API Key",
    pattern: /(api[_-]?key\s*=\s*['"][0-9a-zA-Z\-_]{16,}['"])/i,
    severity: "high",
  },
  {
    name: "Client Secret",
    pattern: /(client[_-]?secret\s*=\s*['"][0-9a-zA-Z\-_]{16,}['"])/i,
    severity: "high",
  },
  {
    name: "Access Token",
    pattern: /(access[_-]?token\s*=\s*['"][0-9a-zA-Z\-_\.]{16,}['"])/i,
    severity: "high",
  },
  {
    name: "Auth Token",
    pattern: /(auth[_-]?token\s*=\s*['"][0-9a-zA-Z\-_\.]{16,}['"])/i,
    severity: "high",
  },
  {
    name: "Session ID",
    pattern: /(session[_-]?id\s*=\s*['"][0-9a-zA-Z\-_]{16,}['"])/i,
    severity: "medium",
  },
  {
    name: "RSA Private Key",
    pattern: /(rsa[_-]?private[_-]?key\s*=\s*['"].+['"])/i,
    severity: "critical",
  },
  { name: "PEM Value", pattern: /(pem\s*=\s*['"].+['"])/i, severity: "high" },
];

function loadIgnorePatterns(baseDir) {
  const ignoreFile = path.join(baseDir, ".shieldxignore");
  if (fs.existsSync(ignoreFile)) {
    const content = fs.readFileSync(ignoreFile, "utf-8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
  }
  return [];
}

function loadWhitelist(baseDir) {
  const whitelistFile = path.join(baseDir, ".shieldxallow");
  if (fs.existsSync(whitelistFile)) {
    const content = fs.readFileSync(whitelistFile, "utf-8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
  }
  return [];
}

function isWhitelisted(content, whitelist) {
  return whitelist.some((pattern) => {
    try {
      // Support both string matching and regex patterns
      if (pattern.startsWith("/") && pattern.endsWith("/")) {
        const regex = new RegExp(pattern.slice(1, -1));
        return regex.test(content);
      }
      return content.includes(pattern);
    } catch (e) {
      return false;
    }
  });
}

function shouldIgnore(filepath, ignorePatterns) {
  return ignorePatterns.some((pattern) => {
    if (pattern.includes("*")) {
      const regex = new RegExp(pattern.replace(/\*/g, ".*"));
      return regex.test(filepath);
    }
    return filepath.includes(pattern);
  });
}

function walk(dir, filelist = [], ignorePatterns = []) {
  const excludeDirs = [
    "node_modules",
    ".git",
    ".idea",
    "dist",
    "build",
    "venv",
    "__pycache__",
    ".vscode",
    ".next",
    "out",
    "target",
    "bin",
    "obj",
    ".gradle",
    ".settings",
    ".mvn",
    ".github",
    ".circleci",
    ".husky",
    ".terraform",
    ".docker",
    "vendor",
  ];
  const excludeFiles = [
    ".gitignore",
    "package-lock.json",
    "package.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "README.md",
    "LICENSE",
    ".env",
    ".env.example",
    ".env.local",
    ".env.production",
    ".env.test",
    ".env.development",
    ".env.sample",
    "Dockerfile",
    "Makefile",
    "CMakeLists.txt",
    "pom.xml",
    "build.gradle",
    "settings.gradle",
    "gradle.properties",
    "gradlew",
    "gradlew.bat",
    "Vagrantfile",
    "Procfile",
    "Jenkinsfile",
    "webpack.config.js",
    "babel.config.js",
    "tsconfig.json",
    "vite.config.js",
    "next.config.js",
    "nuxt.config.js",
    "gatsby-config.js",
    "Gruntfile.js",
    "gulpfile.js",
    "rollup.config.js",
    "metro.config.js",
    "app.json",
    "app.config.js",
    "firebase.json",
    "firestore.rules",
    "firestore.indexes.json",
    "storage.rules",
    "database.rules.json",
    "angular.json",
    "nx.json",
    "workspace.json",
    ".eslintrc.js",
    ".eslintrc.json",
    ".prettierrc",
    ".prettierrc.json",
    ".stylelintrc",
    ".stylelintrc.json",
    ".babelrc",
    ".babelrc.json",
    ".swcrc",
    ".swcrc.json",
    ".commitlintrc.js",
    ".commitlintrc.json",
    "tslint.json",
    "cspell.json",
    "renovate.json",
    "dependabot.yml",
    ".dockerignore",
    "components.json",
    "docker-compose.yml",
    "docker-compose.yaml",
  ];

  if (!fs.existsSync(dir)) {
    throw new Error(`Directory not found: ${dir}`);
  }

  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${dir}`);
  }

  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filepath = path.join(dir, file);

    // Check custom ignore patterns
    if (shouldIgnore(filepath, ignorePatterns)) {
      return;
    }

    const stat = fs.statSync(filepath);
    // Skip excluded dirs
    if (stat.isDirectory()) {
      if (!excludeDirs.some((excluded) => filepath.includes(excluded))) {
        walk(filepath, filelist, ignorePatterns);
      }
    }
    // Skip excluded files
    else if (!excludeFiles.includes(file)) {
      if (
        /\.(js|ts|jsx|tsx|py|go|rb|java|cpp|c|h|cs|php|swift|kt|rs|scala|env|yml|yaml|json|xml|html|vue|svelte)$/.test(
          file
        )
      ) {
        filelist.push(filepath);
      }
    }
  });
  return filelist;
}

export function getFindings(baseDir, options = {}) {
  const ignorePatterns = loadIgnorePatterns(baseDir);
  const whitelist = loadWhitelist(baseDir);
  const files = walk(baseDir, [], ignorePatterns);
  
  let issuesFound = 0;
  const findings = [];
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };

  files.forEach((file) => {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");

      lines.forEach((line, idx) => {
        const trimmedLine = line.trim();

        // Skip comments - these are common false positives
        if (
          trimmedLine.startsWith("//") ||
          trimmedLine.startsWith("#") ||
          trimmedLine.startsWith("/*") ||
          trimmedLine.startsWith("*") ||
          trimmedLine.startsWith("<!--") ||
          trimmedLine.startsWith("import ") ||
          trimmedLine.includes("require(")
        ) {
          return;
        }

        // Skip if it looks like a path
        if (
          trimmedLine.startsWith("@/") ||
          trimmedLine.startsWith("./") ||
          trimmedLine.startsWith("../")
        ) {
          return;
        }

        SECRET_PATTERNS.forEach(({ name, pattern, severity }) => {
          if (pattern.test(line)) {
            // Check if this is whitelisted
            const lineContent = line.trim();
            if (isWhitelisted(lineContent, whitelist)) {
              return;
            }

            issuesFound++;
            severityCounts[severity]++;

            const finding = {
              file,
              line: idx + 1,
              content: line.trim(),
              type: name,
              severity,
            };
            findings.push(finding);
          }
        });
      });
    } catch (err) {
      if (options.verbose) {
        console.log(chalk.gray(`⚠️  Skipped ${file}: ${err.message}`));
      }
    }
  });

  return { findings, files, severityCounts, issuesFound };
}

export function scanCode(baseDir, options = {}) {
  try {
    // Validate input
    if (!baseDir) {
      console.error(chalk.red("❌ Error: Directory path is required"));
      process.exit(1);
    }

    if (!options.quiet && !options.json) {
      console.log(
        chalk.blue(`🔍 Scanning ${baseDir} for hardcoded secrets...\n`)
      );
    }

    const { findings, files, severityCounts, issuesFound } = getFindings(
      baseDir,
      options
    );

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            scannedDirectory: baseDir,
            filesScanned: files.length,
            issuesFound,
            severityCounts,
            findings,
          },
          null,
          2
        )
      );
    } else if (issuesFound === 0) {
      console.log(chalk.green("✅ No hardcoded secrets found! 🎉"));
      console.log(chalk.gray(`   Scanned ${files.length} files`));
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
            ) + chalk.gray(` in ${finding.file}:${finding.line}`)
          );
          console.log(chalk.yellow(`    ${finding.content}`));
          console.log(chalk.green(`    💡 Move this to .env file\n`));
        }
      });

      console.log(chalk.red.bold(`\n⚠️  Security Report:`));
      console.log(chalk.red(`   Total issues: ${issuesFound}`));
      console.log(chalk.gray(`   Files scanned: ${files.length}`));
      console.log();
      if (severityCounts.critical > 0)
        console.log(
          chalk.bgRed.white(` CRITICAL: ${severityCounts.critical} `)
        );
      if (severityCounts.high > 0)
        console.log(chalk.red(`   High: ${severityCounts.high}`));
      if (severityCounts.medium > 0)
        console.log(chalk.yellow(`   Medium: ${severityCounts.medium}`));
      if (severityCounts.low > 0)
        console.log(chalk.blue(`   Low: ${severityCounts.low}`));
    }

    // Exit with appropriate code if called from CLI
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

