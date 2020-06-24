import fs from "fs-minipass";
import { ALL_DOCS_DEST } from "./constants.js";
import JSONStream from "minipass-json-stream";
import map from "map-stream";
import _ from "lodash";
import gh from "github-url-to-object";
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
  return `npm-${name.trim()}`;
};
const getUserId = (username) => {
  return `npm-${username.trim()}`;
};

const getVersionId = (name, version) => {
  return `${name.trim()}--${version.trim()}`;
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
    nextVersionCsv,
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
    const cleanedName = "" + name;
    const cleanedRange = "" + range;
    const key = `${cleanedName}--${cleanedRange}`;
    if (versionRequirements.has(key)) {
      return versionRequirements.get(key).id;
    } else {
      const vrId = versionRequirementCounter.next();
      const packageId = savePackage(cleanedName);
      versionRequirements.set(key, {
        id: vrId,
        name: cleanedName,
        range: cleanedRange,
      });
      versionRequirementCsv.write([vrId, cleanedRange.trim()]);
      requirementOfCsv.write([vrId, packageId]);
      return vrId;
    }
  };

  const savePackage = (name) => {
    const cleanedName = name.trim();
    const id = getPackageId(cleanedName);
    if (!packages.has(cleanedName)) {
      packages.add(cleanedName);
      packageCsv.write([id, cleanedName]);
      inRegistryCsv.write([id, "npm"]);
    }
    return id;
  };

  const saveUser = (username) => {
    const cleanedUsername = username.trim();
    const id = getUserId(cleanedUsername);
    if (!users.has(cleanedUsername)) {
      users.add(cleanedUsername);
      userCsv.write([id, cleanedUsername]);
    }
    return id;
  };

  const saveVersion = (name, packageId, version, timestamp, repository) => {
    // Only handles GitHub repos but these make up ~98% of
    // npm packages, according to
    // https://github.com/nice-registry/all-the-package-repos
    const id = versionCounter.next();
    let normalizedRepo;
    if (typeof repository === "string") {
      normalizedRepo = gh(repository);
    } else if (typeof repository === "object" && "url" in repository) {
      normalizedRepo = gh(repository["url"]);
    }

    let cleanedRepo;
    if (!!normalizedRepo) {
      cleanedRepo = normalizedRepo.https_url;
    }

    versionCsv.write([id, version.trim(), timestamp, cleanedRepo]);
    versionOfCsv.write([id, packageId]);

    const key = getVersionId(name, version);
    versionMap.set(key, id);
    return id;
  };

  const saveDependencies = (versionId, dependencies, type) => {
    Object.entries(dependencies)
      .filter(([depName, depRange]) => !!depName && !!depRange)
      .forEach(([depName, depRange]) => {
        const requirementId = saveVersionRequirement(depName, depRange);
        dependsOnCsv.write([versionId, type, requirementId]);
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
        map((doc, callback) => {
          if (idx === 0) {
            bar.start(totalRows, 0);
          } else if (idx % 1000 === 0) {
            bar.update(idx);
          }

          // Save package
          const name = doc["_id"];
          const repo = doc["repository"];
          const packageId = savePackage(name, repo);

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
              doc["repository"]
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
              Object.entries(maintainers).forEach((m) =>
                saveMaintainer(versionId, m)
              );
            }
          });

          // Now our versions are saved, add NEXT_VERSION relationships between
          // successive ones
          const sortedVersions = semver.sort(
            Object.keys(versions).map(semver.coerce)
          );
          _.zip(sortedVersions, sortedVersions.slice(1)).forEach(
            ([vPrev, vNext]) => {
              if (!vPrev || !vNext) {
                return;
              }
              const idPrev = versionMap.get(getVersionId(name, vPrev.raw));
              const idNext = versionMap.get(getVersionId(name, vNext.raw));
              const timestampPrev = Date.parse(times[vPrev.raw]);
              const timestampNext = Date.parse(times[vNext.raw]);
              const interval = timestampNext - timestampPrev;
              nextVersionCsv.write([idPrev, interval, idNext]);
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
    if (!versions || versions.length === 0 || !name || !id) {
      idx += 1;
      continue;
    }
    const resolvedVersion = resolveVersionRequirement(versions, range);
    if (!!resolvedVersion) {
      const versionId = versionMap.get(`${name.trim()}--${resolvedVersion}`);
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
