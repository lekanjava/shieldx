import { parseEnv } from "../utils/parseEnv.js";
import chalk from "chalk";

export default function compare(file1, file2, options = {}) {
  try {
    // Validate inputs
    if (!file1 || !file2) {
      console.error(chalk.red("❌ Error: Both file paths are required"));
      process.exit(1);
    }

    const env1 = parseEnv(file1);
    const env2 = parseEnv(file2);
const env3 = parseEnv(file2);
    const keys1 = new Set(Object.keys(env1));
    const keys2 = new Set(Object.keys(env2));

    const missing = [...keys1].filter((k) => !keys2.has(k));
    const extra = [...keys2].filter((k) => !keys1.has(k));

    // JSON output
    if (options.json) {
      const result = {
        file1,
        file2,
        inSync: missing.length === 0 && extra.length === 0,
        missing,
        extra,
        stats: {
          file1Keys: keys1.size,
          file2Keys: keys2.size,
          missingCount: missing.length,
          extraCount: extra.length,
        },
      };
      console.log(JSON.stringify(result, null, 2));
      process.exit(missing.length > 0 || extra.length > 0 ? 1 : 0);
    }

    // Regular output
    if (missing.length === 0 && extra.length === 0) {
      console.log(chalk.green("✅ Both files are in sync!"));
      console.log(chalk.gray(`   ${keys1.size} variables checked`));
      process.exit(0);
    } else {
      console.log(
        chalk.bold(
          `\n📊 Comparison: ${chalk.cyan(file1)} vs ${chalk.cyan(file2)}\n`
        )
      );

      if (missing.length > 0) {
        console.log(chalk.red(`❌ Missing in ${file2} (${missing.length}):`));
        missing.forEach((key) => console.log(chalk.red(`   - ${key}`)));
        console.log();
      }

      if (extra.length > 0) {
        console.log(chalk.yellow(`⚠️  Extra in ${file2} (${extra.length}):`));
        extra.forEach((key) => console.log(chalk.yellow(`   + ${key}`)));
        console.log();
      }

      console.log(
        chalk.gray(
          `Total: ${keys1.size} keys in ${file1}, ${keys2.size} keys in ${file2}`
        )
      );
      process.exit(1);
    }
  } catch (err) {
    console.error(chalk.red(`❌ Error: ${err.message}`));
    process.exit(1);
  }
}
