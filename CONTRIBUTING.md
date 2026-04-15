# Contributing to ShieldX

First off, thank you for considering contributing to ShieldX! 🎉

## 🚀 Quick Start

1. Fork the repository
2. Clone your fork: `git clone https://github.com/zeemscript/shieldx.git`
3. Install dependencies: `npm install`
4. Link for local development: `npm link`
5. Create a branch: `git checkout -b feature/amazing-feature`

## 🛠️ Development Workflow

### Running Locally

```bash
# Link the CLI
npm link

# Test commands
shieldx compare test/.env test/.env.example
shieldx scan ./src
```

### Running Tests

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

### Code Style

- Use ES6+ features
- Use meaningful variable names
- Add comments for complex logic
- Follow existing code structure

## 🧪 Adding New Features

### Adding a New Command

1. Create a new file in `src/commands/`
2. Export a function that accepts `(args, options)`
3. Import and register it in `src/index.js`
4. Add tests in `test/unit/`
5. Update README.md with usage examples

Example:

```javascript
// src/commands/mycommand.js
import chalk from "chalk";

export default function myCommand(arg, options = {}) {
  try {
    // Your logic here
    console.log(chalk.green("✅ Success!"));
    process.exit(0);
  } catch (err) {
    console.error(chalk.red(`❌ Error: ${err.message}`));
    process.exit(1);
  }
}
```

### Adding New Secret Patterns

Update `SECRET_PATTERNS` in `src/commands/scan.js`:

```javascript
{
  name: "My Secret Type",
  pattern: /your-regex-here/,
  severity: "high" // critical, high, medium, low
}
```

### Adding Tests

Tests are located in `test/unit/`. Use this template:

```javascript
import { describe, it, expect } from "@jest/globals";
import myFunction from "../../src/myfile.js";

describe("myFunction", () => {
  it("should do something", () => {
    const result = myFunction("test");
    expect(result).toBe("expected");
  });
});
```

## 📝 Commit Guidelines

Use clear and meaningful commit messages:

```
feat: add new validate command
fix: handle empty .env files correctly
docs: update README with new examples
test: add tests for parseEnv utility
refactor: improve error handling
```

Prefixes:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `test:` - Adding tests
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `chore:` - Maintenance tasks

## 🐛 Reporting Bugs

When reporting bugs, please include:

1. **Description** - What happened?
2. **Steps to reproduce** - How can we reproduce it?
3. **Expected behavior** - What should happen?
4. **Environment** - Node version, OS, ShieldX version
5. **Error output** - Full error message/stack trace

## 💡 Feature Requests

We love new ideas! When suggesting features:

1. Check if it already exists in issues
2. Explain the use case
3. Provide examples of how it would work
4. Consider if it fits ShieldX's philosophy (lightweight, security-focused)

## ✅ Pull Request Process

1. **Update tests** - Add/update tests for your changes
2. **Run tests** - Ensure all tests pass (`npm test`)
3. **Update docs** - Update README.md if needed
4. **Clean code** - Remove console.logs, commented code
5. **Single purpose** - One feature/fix per PR
6. **Descriptive title** - Clear PR title and description

### PR Checklist

- [ ] Tests pass locally
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] No console.logs or debug code
- [ ] Code follows existing style
- [ ] Commit messages are clear

## 🔍 Code Review

- Be respectful and constructive
- Respond to feedback promptly
- Small PRs are reviewed faster
- Ask questions if unclear

## 📚 Resources

- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Commander.js Docs](https://github.com/tj/commander.js)
- [Jest Documentation](https://jestjs.io/docs/getting-started)

## 🤝 Community

- Be welcoming and inclusive
- Help others learn
- Share knowledge
- Respect different skill levels

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for making ShieldX better!** ❤️
