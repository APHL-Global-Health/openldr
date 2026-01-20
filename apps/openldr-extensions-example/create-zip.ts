import fs from "fs";
import fse from "fs-extra";
import archiver from "archiver";
import path from "path";

async function createZip() {
  try {
    // Read manifest to get extension details
    const manifest = await fse.readJson("manifest.json");
    const outputFileName = `${manifest.id}-${manifest.version}.zip`;
    const outputPath = path.join(__dirname, "./publish");

    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath);
    }

    const zipPath = path.join(outputPath, outputFileName);

    // Create write stream
    const output = fse.createWriteStream(zipPath);
    const archive = archiver("zip", {
      zlib: { level: 9 }, // Maximum compression
    });

    // Listen for completion
    output.on("close", () => {
      console.log(`Created ${outputFileName} (${archive.pointer()} bytes)`);
    });

    // Handle errors
    archive.on("error", (err) => {
      throw err;
    });

    // Pipe archive to output file
    archive.pipe(output);

    // Add files to the archive
    archive.file("dist/index.js", { name: "index.js" });
    archive.file("dist/manifest.json", { name: "manifest.json" });

    // Add source maps if they exist
    if (await fse.pathExists("dist/index.js.map")) {
      archive.file("dist/index.js.map", { name: "index.js.map" });
    }

    // Add README if it exists
    if (await fse.pathExists("README.md")) {
      archive.file("README.md", { name: "README.md" });
    }

    // Add icon if specified in manifest
    if (manifest.icon && (await fse.pathExists(manifest.icon))) {
      archive.file(manifest.icon, { name: path.basename(manifest.icon) });
    }

    // Finalize the archive
    await archive.finalize();
  } catch (error) {
    console.error("Failed to create zip:", error);
    process.exit(1);
  }
}

createZip();
