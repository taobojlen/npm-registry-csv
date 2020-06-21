import fs from "fs-minipass";
import { ALL_DOCS_DEST } from "./constants.js";
import JSONStream from "minipass-json-stream";
import map from "map-stream";
import semver from "semver";
import cliProgress from "cli-progress";
import { createCsvs } from "./save.js";
import TrieMap from "mnemonist/trie-map.js";
import Trie from "mnemonist/trie.js";

class Counter {
  constructor() {
    this.count = 0;
  }

  next() {
    this.count += 1;
    return this.count;
  }
}

const getPackageId = (name) => {
  return `npm-${name}`;
};
const getUserId = (username) => {
  return `npm-${username}`;
};

export const createObjects = (latestRevision) => {
  const versionCounter = new Counter();
  const versionRequirementCounter = new Counter();

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
  // {set of all packages saved thus far}
  const packages = new Trie();
  // {set of all users saved thus far}
  const users = new Trie();

  // Helper function to avoid saving version requirements
  // more than once. Returns the ID of the VR
  const saveVersionRequirement = (name, range) => {
    const key = `${name}--${range}`;
    if (versionRequirements.has(key)) {
      return versionRequirements.get(key).id;
    } else {
      const vrId = versionRequirementCounter.next();
      const packageId = savePackage(name);
      versionRequirements.set(key, { id: vrId, name, range });
      versionRequirementCsv.write([vrId, range]);
      requirementOfCsv.write([vrId, packageId]);
      return vrId;
    }
  };

  const savePackage = (name) => {
    const id = getPackageId(name);
    if (!packages.has(name)) {
      packageCsv.write([id, name]);
      inRegistryCsv.write([id, "npm"]);
      packages.add(name);
    }
    return id;
  };

  const saveUser = (username) => {
    const id = getUserId(username);
    if (!users.has(username)) {
      userCsv.write([id, username]);
      users.add(username);
    }
    return id;
  };

  const saveVersion = (name, packageId, version, timestamp) => {
    const id = versionCounter.next();
    versionCsv.write([id, version, timestamp]);
    versionOfCsv.write([id, packageId]);
    versionMap.set(`${name}--${version}`, id);
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
          if (idx > 10000) {
            idx += 1;
            callback();
            return;
          }

          // Save package
          const name = doc["_id"];
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
            const versionId = saveVersion(name, packageId, version, timestamp);

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
        bar.stop();
        resolve({
          versionRequirements,
          packageVersions,
          versionMap,
          resolvesToCsv,
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
  resolvesToCsv,
  closeAllCsvs
) => {
  const total = versionRequirements.size;
  let idx = 0;
  const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  bar.start(total, 0);
  for (let vr of versionRequirements) {
    if (idx % 10000 === 0) {
      bar.update(idx);
    }
    const { id, name, range } = vr[1];
    const versions = packageVersions.get(name);
    if (!versions || versions.length === 0) {
      idx += 1;
      continue;
    }
    const resolvedVersion = resolveVersionRequirement(versions, range);
    if (!!resolvedVersion) {
      const versionId = versionMap.get(`${name}--${resolvedVersion}`);
      resolvesToCsv.write([id, versionId]);
    }
    idx += 1;
  }
  bar.stop();
  closeAllCsvs();
};

const resolveVersionRequirement = (versions, range) => {
  const matchingVersions = versions
    .filter((version) => semver.satisfies(version, range))
    .sort(semver.rcompare);

  if (matchingVersions.length > 0) {
    return matchingVersions[0];
  } else {
    // TODO: log ranges that don't resolve to anything
    return;
  }
};
