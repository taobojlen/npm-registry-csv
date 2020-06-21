import fs from "fs-minipass";
import { ALL_DOCS_DEST } from "./constants.js";
import JSONStream from "minipass-json-stream";
import map from "map-stream";
import semver from "semver";
import cliProgress from "cli-progress";
import { createCsvs } from "./save.js";
import TrieMap from "mnemonist/trie-map.js";
import Trie from "mnemonist/trie.js";

export const createObjects = (latestRevision) => {
  let numNodes = 0;
  const getNextId = () => {
    const prev = numNodes;
    numNodes += 1;
    return prev;
  };
  const {
    registryCsv,
    packageCsv,
    versionCsv,
    versionRequirementCsv,
    userCsv,
    versionOfCsv,
    dependsOnCsv,
    requirementOfCsv,
    resolvesToCsv,
    maintainsCsv,
    inRegistryCsv,
    closeAllCsvs,
  } = createCsvs();
  registryCsv.write(["npm", latestRevision]);
  // Save versions of each package for later to handle version resolutions
  // {name--range => {id: version requirement ID, name: name, range: range}}
  const versionRequirements = new TrieMap();
  // {name => list of versions}
  const packageVersions = new TrieMap();
  // {name--version => version ID}
  const versionMap = new TrieMap();
  // Contains all usernames already saved
  const usersTrie = new Trie();

  // Helper function to avoid saving version requirements
  // more than once. Returns the ID of the VR
  const saveVersionRequirement = (name, range) => {
    const key = `${name}--${range}`;
    if (versionRequirements.has(key)) {
      return versionRequirements.get(key).id;
    } else {
      const id = getNextId();
      versionRequirements.set(key, { id, name, range });
      versionRequirementCsv.write([id, range]);
      requirementOfCsv.write([id, `npm-${name}`]);
      return id;
    }
  };

  const saveUser = (username) => {
    const id = `npm-${username}`;
    if (!usersTrie.has(username)) {
      userCsv.write([id, username]);
      usersTrie.add(username);
    }
    return id;
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
        map((doc, callback) => {
          if (idx === 0) {
            bar.start(totalRows, 0);
          } else if (idx % 1000 === 0) {
            bar.update(idx);
          }

          // Save package
          const name = doc["_id"];
          const packageId = `npm-${name}`;
          packageCsv.write([packageId, name]);
          inRegistryCsv.write([packageId, "npm"]);

          // Save its versions, their dependencies, and their maintainers
          const versions = doc["versions"];
          if (!versions) {
            packageVersions.set(name, []);
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
            const versionId = getNextId();
            let timestamp;
            if (!!times && version in times) {
              timestamp = times[version];
            } else {
              timestamp = "";
            }
            versionCsv.write([versionId, version, timestamp]);
            versionOfCsv.write([versionId, packageId]);
            versionMap.set(`${name}--${version}`, versionId);

            // Save dependencies
            if (!!versionDetails["dependencies"]) {
              Object.entries(versionDetails["dependencies"]).forEach(
                ([depName, depRange]) => {
                  const requirementId = saveVersionRequirement(
                    depName,
                    depRange
                  );
                  dependsOnCsv.write([versionId, "normal", requirementId]);
                }
              );
            }
            if (!!versionDetails["devDependencies"]) {
              Object.entries(versionDetails["devDependencies"]).forEach(
                ([depName, depRange]) => {
                  const requirementId = saveVersionRequirement(
                    depName,
                    depRange
                  );
                  dependsOnCsv.write([versionId, "dev", requirementId]);
                }
              );
            }
            if (!!versionDetails["peerDependencies"]) {
              Object.entries(versionDetails["peerDependencies"]).forEach(
                ([depName, depRange]) => {
                  const requirementId = saveVersionRequirement(
                    depName,
                    depRange
                  );
                  dependsOnCsv.write([versionId, "peer", requirementId]);
                }
              );
            }

            const saveMaintainer = (maintainer) => {
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

            // Save maintainers
            const maintainers = versionDetails["maintainers"];
            if (!!maintainers && Array.isArray(maintainers)) {
              maintainers.forEach(saveMaintainer);
            } else if (!!maintainers) {
              Object.entries(maintainers).forEach(saveMaintainer);
            }
          });

          // Must call the callback to indicate that the map function is done
          idx += 1;
          callback();
        })
      );

      fileStream.on("end", () => {
        resolveVersions(
          versionRequirements,
          packageVersions,
          versionMap,
          resolvesToCsv,
          closeAllCsvs
        );
        resolve();
      });
    } catch (e) {
      reject(e);
    }
  });
};

export const resolveVersions = (
  versionRequirements,
  packageVersions,
  versionMap,
  resolvesToCsv,
  closeAllCsvs
) => {
  const total = versionRequirements.size;
  let idx = 1;
  for (let vr of versionRequirements) {
    const { id, name, range } = vr[1];
    if (idx % 100 === 0) {
      console.log(`${idx}/${total} done`);
    }
    const versions = packageVersions.get(name);
    if (!versions || versions.length === 0) {
      continue;
    }
    const resolution = resolveVersionRequirement(versions, range);
    if (!!resolution) {
      versionId = versionMap.get(`${name}--${version}`);
      resolvesToCsv.write([id, versionId]);
    }
    idx += 1;
  }
  closeAllCsvs();
};

const resolveVersionRequirement = (versions, range) => {
  const matchingVersions = versions
    .filter((version) => semver.satisfies(version, range))
    .sort(semver.rcompare);

  if (matchingVersions.length > 0) {
    return matchingVersions[0];
  } else {
    console.error(
      `No version of ${versionRequirement.packageName} matches the range ${versionRequirement.requirement}`
    );
    return;
  }
};
