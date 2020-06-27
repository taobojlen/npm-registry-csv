import { Counter, getVersionId, resolveVersionRequirement } from "./util";
import gh from "github-url-to-object";
import {
  versionRequirementCsv,
  requirementOfCsv,
  packageCsv,
  userCsv,
  versionCsv,
  versionOfCsv,
  dependsOnCsv,
  maintainsCsv,
  nextVersionCsv,
  resolvesToCsv,
} from "./csv";
import { StringMap, DependencyType, Maintainer } from "./types";
import {
  versionRequirements,
  packages,
  users,
  packageVersions,
} from "./inMemoryData";
import { chain, zip } from "lodash";
import semver from "semver";

const versionRequirementCounter = new Counter();

// Helper function to avoid saving version requirements
// more than once. Returns the ID of the VR
export const saveVersionRequirement = (name: string, range: string) => {
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

export const savePackage = (name: string) => {
  const cleanedName = name.trim();
  if (!packages.has(cleanedName)) {
    packages.add(cleanedName);
    packageCsv.write([cleanedName]);
  }
  return cleanedName;
};

export const saveUser = (username: string) => {
  const cleanedUsername = username.trim();
  if (!users.has(cleanedUsername)) {
    users.add(cleanedUsername);
    userCsv.write([cleanedUsername]);
  }
  return cleanedUsername;
};

export const saveVersion = (
  name: string,
  packageId: string,
  version: string,
  timestamp: string,
  repository: string,
  dist: any
) => {
  // Only handles GitHub repos but these make up ~98% of
  // npm packages, according to
  // https://github.com/nice-registry/all-the-package-repos
  let normalizedRepo;
  let cleanedRepo;
  try {
    if (typeof repository === "string") {
      normalizedRepo = gh(repository);
    } else if (
      typeof repository === "object" &&
      "url" in repository &&
      !!repository["url"]
    ) {
      normalizedRepo = gh(repository["url"]);
    }
    if (!!normalizedRepo) {
      cleanedRepo = normalizedRepo.https_url;
    }
  } catch {
    console.error(`Failed to parse repo in ${name}`);
  }

  // Handle info about the unpacked tarball
  let fileCount: number;
  let unpackedSize: number;
  if (!!dist) {
    fileCount = dist.fileCount;
    unpackedSize = dist.unpackedSize;
  }

  const id = getVersionId(name, version);
  versionCsv.write([
    id,
    version.trim(),
    timestamp,
    cleanedRepo,
    fileCount,
    unpackedSize,
  ]);
  versionOfCsv.write([id, packageId]);

  return id;
};

export const saveDependencies = (
  versionId: string,
  dependencies: StringMap,
  type: DependencyType
) => {
  Object.entries(dependencies)
    .filter(([depName, depRange]) => !!depName && !!depRange)
    .forEach(([depName, depRange]) => {
      const requirementId = saveVersionRequirement(depName, depRange);
      dependsOnCsv.write([versionId, type, requirementId]);
    });
};

export const saveMaintainer = (versionId: string, maintainer: Maintainer) => {
  // Sometimes each maintainer is a {name: "...", email: "..."} object,
  // other times it's just a string.
  let username: string;
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

export const saveNextVersions = (name: string, versions: string[], times: StringMap) => {
  let sortedVersions = chain(Object.keys(versions))
    .map((v) => semver.parse(v))
    .filter((v) => !!v)
    .uniq()
    .sort(semver.compare)
    .map((v) => v.raw)
    .value();

  zip(sortedVersions, sortedVersions.slice(1)).forEach(([vPrev, vNext]) => {
    if (!vPrev || !vNext || !times) {
      return;
    }
    const idPrev = getVersionId(name, vPrev);
    const idNext = getVersionId(name, vNext);
    const timestampPrev = Date.parse(times[vPrev] || "");
    const timestampNext = Date.parse(times[vNext] || "");
    const interval = timestampNext - timestampPrev;
    if (!!interval && !isNaN(interval)) {
      nextVersionCsv.write([idPrev, interval, idNext]);
    }
  });
};

export const saveResolvesTo = (vrId: number, name: string, range: string) => {
  const versions = packageVersions.get(name);
  if (!versions || versions.length === 0 || !name || !vrId) {
    return;
  }
  const resolvedVersion = resolveVersionRequirement(versions, range);
  if (!!resolvedVersion) {
    const versionId = getVersionId(name, resolvedVersion);
    resolvesToCsv.write([vrId, versionId]);
  }
};
