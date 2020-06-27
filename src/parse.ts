import fs from "fs-minipass";
import { ALL_DOCS_DEST } from "./constants";
import JSONStream from "minipass-json-stream";
import es from "event-stream";
import semver from "semver";
import cliProgress from "cli-progress";

import { savePackage, processVersionRequirements } from "./database";
import { parseVersion, swapKeysAndValues } from "./util";

export const createObjects = () => {
  let idx = 0;
  return new Promise((resolve, reject) => {
    try {
      const fileStream = new fs.ReadStream(ALL_DOCS_DEST);
      const jsonStream = JSONStream.parse("rows.*.doc");
      let totalRows: number;
      const bar = new cliProgress.SingleBar(
        {},
        cliProgress.Presets.shades_classic
      );
      jsonStream.on("header", (data) => {
        // Everything before the rows, which includes the total_rows field
        totalRows = data["total_rows"];
      });
      fileStream.pipe(jsonStream).pipe(
        es.map(async (doc, callback) => {
          if (idx === 0) {
            bar.start(totalRows, 0);
          }
          bar.update(idx);

          // Save package
          const name = doc["_id"];

          // Compile versions of the package
          const rawVersions = doc["versions"] || [];
          const times = doc["time"];
          const packageTagsForVersion = swapKeysAndValues(doc["dist-tags"]);
          const versions = Object.entries(
            rawVersions
          ).map(([version, versionDetails]) =>
            parseVersion(version, versionDetails, times, packageTagsForVersion)
          );

          await savePackage({ name, versions });

          // Must call the callback to indicate that the map function is done
          idx += 1;
          callback();
        })
      );

      fileStream.on("end", () => {
        bar.stop();
        resolve();
      });
    } catch (e) {
      console.error(e);
      reject(e);
    }
  });
};

export const resolveVersions = async () => {
  await processVersionRequirements(undefined)
  // const total = versionRequirements.size();
  // let idx = 0;
  // const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  // bar.start(total, 0);

  // for (let vr of versionRequirements.trieMap.entries()) {
  //   if (idx % 10000 === 0) {
  //     bar.update(idx);
  //   }
  //   // name: the package being depended upon
  //   // range: the version range specified in the dependency
  //   // versionIds: a list of {versionId, type} objects, one for each
  //   // version that depends on this package (and the dependency type;
  //   // one of "normal", "peer", and "dev")
  //   const { name, range, versionIds } = vr[1];

  //   const versions = packageVersions.get(name);
  //   if (!versions || versions.length === 0 || !name || !range) {
  //     idx += 1;
  //     continue;
  //   }

  //   // Check dist tags for the version ID; otherwise try to resolve version range
  //   let resolvedVersionId = distTags.get(`${name}--${range}`);
  //   if (!resolvedVersionId) {
  //     const resolvedVersion = resolveVersionRequirement(name, versions, range);
  //     resolvedVersionId = versionMap.get(`${name.trim()}--${resolvedVersion}`);
  //   }

  //   if (!!resolvedVersionId) {
  //     versionIds.forEach(([versionId, type]) => {
  //       dependsOnCsv.write([versionId, type, range, resolvedVersionId]);
  //     });
  //   }
  //   idx += 1;
  // }
  // bar.stop();
  // closeAllCsvs();
};

const resolveVersionRequirement = (name, versions, range) => {
  const matchingVersions = versions
    .filter((version) => semver.satisfies(version, range))
    .sort(semver.rcompare);

  if (matchingVersions.length > 0) {
    return matchingVersions[0];
  } else {
    console.log(
      `${name}: range "${range}" did not resolve to any of ${versions}`
    );
    return;
  }
};
