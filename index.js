import { getCurrentRevision, getAllDocs } from "./src/download.js";
import { createObjects, resolveVersions } from "./src/parse.js";
import fs from "fs";
import { ALL_DOCS_DEST } from "./src/constants.js";

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
    console.log("Extracting objects from JSON");
    const {
      versionRequirements,
      packageVersions,
      versionMap,
      resolvesToCsv,
      closeAllCsvs,
    } = await createObjects(latestRevision);
    console.log("Resolving version ranges");
    resolveVersions(
      versionRequirements,
      packageVersions,
      versionMap,
      resolvesToCsv,
      closeAllCsvs
    );
    console.log("Done! View .csvs in the data/ directory.");
    return;
  } catch (e) {
    console.error(e);
    return;
  }
};

main();
