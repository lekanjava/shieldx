# 🛡️ ShieldX

**ShieldX** is a blazing-fast CLI tool to **compare, sync, validate, and scan** your environment/config files.
It helps developers avoid missing variables, catch hardcoded secrets in code, and keep configs consistent across environments.

> Short. Secure. Smart. — That's ShieldX.

[![npm version](https://badge.fury.io/js/shieldx.svg)](https://www.npmjs.com/package/shieldx)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI/CD](https://github.com/zeemscript/shieldx/workflows/CI%2FCD%20Pipeline/badge.svg)](https://github.com/zeemscript/shieldx/actions)

---

## 🚀 Features

- 🔍 **Compare**: Check differences between `.env` files (e.g., `.env` vs `.env.production`)
- ⚡ **Generate**: Create a `.env.example` automatically from an existing `.env`
- 🛡️ **Scan**: Detect **hardcoded secrets** (API keys, tokens, DB URLs) with severity levels
- 🔧 **Fix**: Interactively move hardcoded secrets to `.env` and replace them in code
- ✅ **Validate**: Ensure `.env` files have all required variables
- 📊 **JSON Output**: Perfect for CI/CD pipelines
- 🚫 **Smart Ignoring**: Use `.shieldxignore` to skip files
- 🎯 **Exit Codes**: Non-zero exit on issues for CI/CD integration
- 📦 Lightweight: Zero bloat
- 🔒 Security-first: 30+ secret pattern detectors with severity levels

---

## 📦 Installation

Use it instantly with **npx** (no install required):

```bash
npx shieldx compare .env .env.example
```

Or install globally:

```bash
npm install -g shieldx
```

---

## 🖥️ Usage

### 1. Compare two `.env` files

Compare files and see missing/extra variables:

```bash
shieldx compare .env .env.production
```

**Options:**

- `-j, --json` - Output in JSON format
- `-v, --verbose` - Show detailed output

**Example output:**

```
📊 Comparison: .env vs .env.production

❌ Missing in .env.production (2):
   - SECRET_KEY
   - API_TOKEN

⚠️  Extra in .env.production (1):
   + NEW_FEATURE_FLAG

Total: 10 keys in .env, 9 keys in .env.production
```

**CI/CD Integration:**

```bash
# Exit code 1 if files don't match
shieldx compare .env .env.example --json > comparison.json
```

---

### 2. Generate `.env.example`

Create a template file with keys only (no sensitive values):

```bash
shieldx generate .env
```

**Options:**

- `-o, --output <file>` - Custom output path (default: `.env.example`)
- `-f, --force` - Overwrite existing file
- `-j, --json` - Output in JSON format
- `-v, --verbose` - List all generated keys

**Examples:**

```bash
# Generate with custom output
shieldx generate .env -o .env.template

# Force overwrite
shieldx generate .env --force

# See what keys were generated
shieldx generate .env --verbose
```

---

### 3. Scan project for hardcoded secrets

Detect hardcoded API keys, passwords, tokens, and more:

```bash
shieldx scan ./src
```

**Options:**

- `-j, --json` - Output in JSON format for parsing
- `-v, --verbose` - Show skipped files
- `-q, --quiet` - Only show errors

**Security Patterns Detected:**

- ✅ Stripe API keys (live & test)
- ✅ AWS credentials
- ✅ GitHub tokens
- ✅ Google API keys
- ✅ Database connection strings
- ✅ JWT tokens
- ✅ Private keys (RSA, PEM, SSH)
- ✅ OAuth tokens (Slack, Facebook, Google)
- ✅ Bearer tokens
- ✅ And 20+ more patterns!

**Severity Levels:**

- 🔴 **CRITICAL** - Private keys, credentials with immediate risk
- 🟠 **HIGH** - API keys, tokens, passwords
- 🟡 **MEDIUM** - Session IDs, JWTs
- 🔵 **LOW** - Potential secrets, long strings

**Example output:**

```
🔍 Scanning ./src for hardcoded secrets...

🚨 [HIGH] Stripe Live Key in src/payment.js:15
    const key = "sk_live_abcd1234..."
    💡 Move this to .env file

⚠️  Security Report:
   Total issues: 3
   Files scanned: 47

 CRITICAL: 1
   High: 2
```

**Use `.shieldxignore`:**
Create a `.shieldxignore` file to skip certain paths:

```
# ShieldX Ignore Patterns
**/test/**
*.test.js
docs/
```

---

### 4. Validate required variables

Ensure `.env` files have all required keys:

```bash
shieldx validate .env --keys "DATABASE_URL,API_KEY,SECRET"
```

**Options:**

- `-k, --keys <keys>` - Comma-separated required keys
- `-c, --config <file>` - Load required keys from file
- `-j, --json` - Output in JSON format
- `-v, --verbose` - Show all present keys

**Using a config file:**
Create `required-keys.txt`:

```
DATABASE_URL
API_KEY
SECRET_KEY
```

Then run:

```bash
shieldx validate .env --config required-keys.txt
```

**Example output:**

```
🔍 Validating .env

❌ Missing 2 required variable(s):

  ✗ API_KEY
  ✗ SECRET_KEY

💡 Add the missing variables to .env
```

---

### 5. Fix hardcoded secrets

Interactively move secrets from your code to `.env`:

```bash
shieldx fix ./src
```

**Options:**

- `--auto` - Move all High/Critical secrets automatically
- `--dry-run` - Preview changes without modifying files
- `--env-file <file>` - Target `.env` file (default: `.env`)

**Example:**
ShieldX will find a secret:
`const KEY = "sk_live_12345";`

And replace it with:
`const KEY = process.env.STRIPE_LIVE_KEY;`

While adding the following to your `.env`:
`STRIPE_LIVE_KEY="sk_live_12345"`

---

## 🔧 Advanced Usage

### CI/CD Integration

ShieldX returns exit code 1 on issues, perfect for CI/CD:

```yaml
# GitHub Actions example
- name: Validate environment
  run: |
    shieldx compare .env.example .env.production --json
    shieldx scan ./src
    shieldx validate .env.production --keys "DATABASE_URL,API_KEY"
```

### Pre-commit Hook

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
shieldx scan ./src --quiet
if [ $? -ne 0 ]; then
  echo "❌ Secrets detected! Fix them before committing."
  exit 1
fi
```

### JSON Output for Automation

All commands support `--json` flag:

```bash
# Get JSON output for parsing
shieldx scan ./src --json > security-report.json

# Parse with jq
shieldx scan ./src --json | jq '.issuesFound'
```

---

## 📅 Roadmap

- [x] Compare `.env` files
- [x] Generate `.env.example`
- [x] Scan for secrets with severity levels
- [x] Validate required keys
- [x] JSON output for CI/CD
- [x] `.shieldxignore` support
- [x] Exit codes for automation
- [x] GitHub Actions integration
- [x] Auto-fix suggestions
- [ ] Sync configs across environments
- [ ] VSCode plugin integration
- [ ] AI-powered secret detection (v2)
- [ ] Encrypt/decrypt `.env` files

---

## 🛠️ Development

Clone and run locally:

```bash
git clone https://github.com/zeemscript/shieldx.git
cd shieldx
npm install
npm link
```

Run tests:

```bash
npm test
npm run test:watch
```

Now you can run:

```bash
shieldx compare .env .env.example
```

---

## 🧪 Testing

ShieldX includes a comprehensive test suite:

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Watch mode
npm run test:watch
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Check [issues](https://github.com/zeemscript/shieldx/issues) for ideas!

---

## 📜 License

[MIT](./LICENSE) © 2025 [zeemscript](https://github.com/zeemscript)

---

## 💡 Tips

**Best Practices:**

- ✅ Run `shieldx scan` before every commit
- ✅ Use `shieldx validate` in deployment pipelines
- ✅ Keep `.env.example` updated with `shieldx generate`
- ✅ Never commit `.env` files (add to `.gitignore`)
- ✅ Use `.shieldxignore` for test fixtures

**Common Workflows:**

```bash
# Setup new project
shieldx generate .env
git add .env.example

# Before deploying
shieldx validate .env.production --keys "DATABASE_URL,API_KEY"
shieldx compare .env.example .env.production

# Security audit
shieldx scan ./src --verbose
```

---

**Made with ❤️ by developers, for developers.**
