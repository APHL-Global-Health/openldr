import fs from "fs";
// import path from "path";

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error(
    "Usage: tsx merge-env.ts <input-file1> <input-file2> ... <output-file>",
  );
  process.exit(1);
}

const outputFile = args[args.length - 1];
const inputFiles = args.slice(0, -1);

const merged = inputFiles
  .map((file) => {
    try {
      const content = fs.readFileSync(file, "utf8");
      return content;
    } catch (err) {
      console.error(`Warning: Could not read ${file}`);
      return "";
    }
  })
  .filter(Boolean)
  .join("\n");

fs.writeFileSync(outputFile, merged);
