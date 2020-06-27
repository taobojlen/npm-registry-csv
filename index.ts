import { getAllDocs } from "./src/download";
import { createObjects } from "./src/parse";
import fs from "fs";
import { ALL_DOCS_DEST } from "./src/constants";
import { createCsvs } from "./src/csv";
import { resolveVersions } from "./src/resolveVersions";

const main = async () => {
  const allDocsExists = fs.existsSync(ALL_DOCS_DEST);
  try {
    if (allDocsExists) {
      console.log(`${ALL_DOCS_DEST} exists, skipping download.`);
    } else {
      console.log("Downloading npm data");
      await getAllDocs();
    }

    console.log("Creating .csvs");
    createCsvs();

    console.log("Extracting objects from JSON");
    await createObjects();

    console.log("Resolving version ranges");
    resolveVersions();

    console.log("Done! View .csvs in the data/ directory.");
    return;
  } catch (e) {
    console.error(e);
    return;
  }
};

main();
