import fs from "fs-minipass";
import { ALL_DOCS_DEST } from "./constants";
import JSONStream from "minipass-json-stream";
import * as es from "event-stream";
import cliProgress from "cli-progress";
import { swapKeysAndValues } from "./util";
import {savePackage, saveVersion, saveDependencies, saveMaintainer, saveNextVersions} from "./save"
import { packageVersions } from "./inMemoryData";

export const createObjects = () => {
  let idx = 0;
  return new Promise((resolve, reject) => {
    try {
      const fileStream = new fs.ReadStream(ALL_DOCS_DEST);
      const jsonStream = JSONStream.parse("rows.*.doc");
      let totalRows;
      const bar = new cliProgress.SingleBar(
        {},
        cliProgress.Presets.shades_classic
      );
      jsonStream.on("header", (data) => {
        // Everything before the rows, which includes the total_rows field
        totalRows = data["total_rows"];
      });
      fileStream.pipe(jsonStream).pipe(
        es.map((doc, callback) => {
          if (idx === 0) {
            bar.start(totalRows, 0);
          } else if (idx % 1000 === 0) {
            bar.update(idx);
          }

          // Save package
          const name = doc["_id"];
          const packageTagsForVersion = swapKeysAndValues(doc["dist-tags"]);
          const packageId = savePackage(name);

          // Save its versions, their dependencies, and their maintainers
          const versions = doc["versions"];
          if (!versions) {
            packageVersions.set(name, []);
            idx += 1;
            callback();
            return;
          }
          const times = doc["time"];
          packageVersions.set(name, Object.keys(versions));

          Object.entries(versions).forEach(([version, versionDetails]) => {
            if (typeof versionDetails != "object") {
              return;
            }
            // Save version
            let timestamp;
            if (!!times && version in times) {
              timestamp = times[version];
            } else {
              timestamp = "";
            }

            const versionId = saveVersion(
              name,
              packageId,
              version,
              timestamp,
              doc["repository"],
              versionDetails["dist"]
            );

            // Save dependencies
            if (!!versionDetails["dependencies"]) {
              saveDependencies(
                versionId,
                versionDetails["dependencies"],
                "normal"
              );
            }
            if (!!versionDetails["devDependencies"]) {
              saveDependencies(
                versionId,
                versionDetails["devDependencies"],
                "dev"
              );
            }
            if (!!versionDetails["peerDependencies"]) {
              saveDependencies(
                versionId,
                versionDetails["peerDependencies"],
                "peer"
              );
            }

            // Save maintainers
            const maintainers = versionDetails["maintainers"];
            if (!!maintainers && Array.isArray(maintainers)) {
              maintainers.forEach((m) => saveMaintainer(versionId, m));
            } else if (!!maintainers) {
              // TODO
              console.error(maintainers )
              // Object.entries(maintainers).forEach((m) =>
              //   saveMaintainer(versionId, m)
              // );
            }
          });

          saveNextVersions(name, versions, times);

          // Now our versions are saved, add NEXT_VERSION relationships between
          // successive ones

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
