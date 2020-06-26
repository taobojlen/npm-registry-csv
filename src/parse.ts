import fs from "fs-minipass";
import { ALL_DOCS_DEST } from "./constants.js";
import JSONStream from "minipass-json-stream";
import es from "event-stream";
import _ from "lodash";
import gh from "github-url-to-object";
import semver from "semver";
import cliProgress from "cli-progress";

import { savePackage, saveVersion } from "./database.js";
import { normalizeRepo } from "./util.js";
import { Version } from "./types.js";

export const createObjects = () => {
  const saveUser = (username) => {
    const cleanedUsername = username.trim();
    const id = getUserId(cleanedUsername);
    if (!users.has(cleanedUsername)) {
      users.add(cleanedUsername);
      userCsv.write([id, cleanedUsername]);
    }
    return id;
  };

  const saveDependencies = (versionId, dependencies, type) => {
    Object.entries(dependencies)
      .filter(([depName, depRange]) => !!depName && !!depRange)
      .forEach(([depName, depRange]) => {
        versionRequirements.add(depName, depRange, versionId, type);
      });
  };

  const saveMaintainer = (versionId, maintainer) => {
    // Sometimes each maintainer is a {name: "...", email: "..."} object,
    // other times it's just a string.
    let username;
    if (typeof maintainer === "object" && "name" in maintainer) {
      username = maintainer["name"];
    } else if (typeof maintainer === "string") {
      username = maintainer;
    } else {
      return;
    }
    const userId = saveUser(username);
    maintainsCsv.write([userId, versionId]);
  };

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
        es.map(async (doc, callback) => {
          if (idx === 0) {
            bar.start(totalRows, 0);
          } else if (idx % 1000 === 0) {
            bar.update(idx);
          }

          // Save package
          const name = doc["_id"];
          await savePackage(name);

          // Save its versions, their dependencies, and their maintainers
          const versions = doc["versions"];
          if (!versions) {
            idx += 1;
            callback();
            return;
          }
          const times = doc["time"];
          const packageTagsForVersion = Object.entries(doc["dist-tags"]).reduce(
            (acc, entry) => {
              const [tag, version] = entry;
              acc[version] = tag;
              return acc;
            },
            {}
          );

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

            const versionObject: Version = {
              version,
              timestamp,
              repository: normalizeRepo(doc["repository"]),
              fileCount: doc["dist"] && doc["dist"].fileCount,
              unpackedSize: doc["dist"] && doc["dist"].unpackedSize,
            };

            const versionId = saveVersion(name, versionObject);

            // Track version tags
            const tag = packageTagsForVersion[version];
            if (!!tag) {
              // distTags.set(`${name}--${tag}`, versionId);
            }

            // Save dependencies
            const allDependencies = _.concat(
              versionDetails["dependencies"],
              versionDetails["devDependencies"],
              versionDetails["peerDependencies"]
            ).filter((d) => !!d);

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
              Object.entries(maintainers).forEach((m) =>
                saveMaintainer(versionId, m)
              );
            }
          });

          // Now our versions are saved, add NEXT_VERSION relationships between
          // successive ones
          let sortedVersions = _.chain(Object.keys(versions))
            .map((v) => semver.parse(v))
            .filter((v) => !!v)
            .uniq()
            .sort(semver.compare)
            .value();

          _.zip(sortedVersions, sortedVersions.slice(1)).forEach(
            ([vPrev, vNext]) => {
              if (
                !vPrev ||
                !vNext ||
                !times ||
                !vPrev.raw in times ||
                !vNext.raw in times
              ) {
                return;
              }
              const idPrev = versionMap.get(getVersionKey(name, vPrev.raw));
              const idNext = versionMap.get(getVersionKey(name, vNext.raw));
              const timestampPrev = Date.parse(times[vPrev.raw]);
              const timestampNext = Date.parse(times[vNext.raw]);
              const interval = timestampNext - timestampPrev;
              if (!!interval && !isNaN(interval) && !!idPrev && !!idNext) {
                nextVersionCsv.write([idPrev, interval, idNext]);
              }
            }
          );

          // Must call the callback to indicate that the map function is done
          idx += 1;
          callback();
        })
      );

      fileStream.on("end", () => {
        bar.stop();
        resolve({
          versionRequirements,
          packageVersions,
          versionMap,
          dependsOnCsv,
          distTags,
          closeAllCsvs,
        });
      });
    } catch (e) {
      console.error(e);
      reject(e);
    }
  });
};

export const resolveVersions = (
  versionRequirements,
  packageVersions,
  versionMap,
  dependsOnCsv,
  distTags,
  closeAllCsvs
) => {
  const total = versionRequirements.size();
  let idx = 0;
  const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  bar.start(total, 0);

  for (let vr of versionRequirements.trieMap.entries()) {
    if (idx % 10000 === 0) {
      bar.update(idx);
    }
    // name: the package being depended upon
    // range: the version range specified in the dependency
    // versionIds: a list of {versionId, type} objects, one for each
    // version that depends on this package (and the dependency type;
    // one of "normal", "peer", and "dev")
    const { name, range, versionIds } = vr[1];

    const versions = packageVersions.get(name);
    if (!versions || versions.length === 0 || !name || !range) {
      idx += 1;
      continue;
    }

    // Check dist tags for the version ID; otherwise try to resolve version range
    let resolvedVersionId = distTags.get(`${name}--${range}`);
    if (!resolvedVersionId) {
      const resolvedVersion = resolveVersionRequirement(name, versions, range);
      resolvedVersionId = versionMap.get(`${name.trim()}--${resolvedVersion}`);
    }

    if (!!resolvedVersionId) {
      versionIds.forEach(([versionId, type]) => {
        dependsOnCsv.write([versionId, type, range, resolvedVersionId]);
      });
    }
    idx += 1;
  }
  bar.stop();
  closeAllCsvs();
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
