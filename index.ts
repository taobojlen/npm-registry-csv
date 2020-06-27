import { getCurrentRevision, getAllDocs } from "./src/download";
import { createObjects, resolveVersions } from "./src/parse";
import fs from "fs";
import { ALL_DOCS_DEST } from "./src/constants";
import { setupDatabase } from "./src/database";

const main = async () => {
  let latestRevision;
  const allDocsExists = fs.existsSync(ALL_DOCS_DEST);
  try {
    if (allDocsExists) {
      console.log(`${ALL_DOCS_DEST} exists, skipping download.`);
    } else {
      console.log("Getting current npm revision");
      latestRevision = await getCurrentRevision();
      console.log(`Latest revision: ${latestRevision}`);
      console.log("Downloading npm data");
      await getAllDocs();
    }
    console.log("Setting up db");
    await setupDatabase();
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
