import { Counter, getVersionId, resolveVersionRequirement } from "./util";
import gh from "github-url-to-object";
import validator from "validator";
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
  dependsOnResolvesToCsv,
  packageDependsOnCsv,
} from "./csv";
import {
  StringMap,
  DependencyType,
  Maintainer,
  Dependent,
  Dependency,
} from "./types";
import {
  versionRequirements,
  packages,
  users,
  packageVersions,
  packageTags,
} from "./inMemoryData";
import { chain, zip } from "lodash";
import semver from "semver";
import {
  SUSPICIOUS_INSTALL_SCRIPTS,
  SUSPICIOUS_UNINSTALL_SCRIPTS,
} from "./constants";

const versionRequirementCounter = new Counter();

// Helper function to avoid saving version requirements
// more than once. Returns the ID of the VR
export const saveVersionRequirement = (
  name: string,
  range: string,
  dependentName: string,
  dependentVersion: string
) => {
  if (!name || !range) {
    console.error(`No name/range (${name}/${range})`);
  }
  const cleanedName = ("" + name).trim();
  const cleanedRange = ("" + range).trim();
  const key = `${cleanedName}--${cleanedRange}`;
  if (versionRequirements.has(key)) {
    return versionRequirements.get(key).id;
  } else {
    const vrId = versionRequirementCounter.next();
    const packageId = savePackage(cleanedName);
    if (!!vrId && !!packageId) {
      versionRequirements.set(
        key,
        vrId,
        cleanedName,
        cleanedRange,
        dependentName,
        dependentVersion
      );
      versionRequirementCsv.write([vrId, cleanedRange]);
      requirementOfCsv.write([vrId, packageId]);
    }
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

export const savePackageDependencies = (
  name: string,
  dependencies: Dependency[]
) => {
  const cleanedName = ("" + name).trim();
  dependencies.forEach(({ name: dependencyName, type }) => {
    const cleanedDepName = ("" + dependencyName).trim();
    if (
      validator.isURL(cleanedDepName) ||
      cleanedDepName.startsWith("file://")
    ) {
      return;
    }
    packageDependsOnCsv.write([cleanedName, type, cleanedDepName]);
  });
};

export const saveUser = (username: string, email?: string) => {
  const cleanedUsername = username.trim();
  if (!users.has(cleanedUsername)) {
    users.add(cleanedUsername);
    userCsv.write([cleanedUsername, email]);
  }
  return cleanedUsername;
};

export const saveVersion = (
  name: string,
  packageId: string,
  version: string,
  timestamp: string,
  repository: string,
  dist: any,
  scripts: StringMap
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

  // Look for install scripts
  let installScript: string;
  let uninstallScript: string;
  if (!!scripts) {
    installScript = Object.entries(scripts)
      .filter(([hook, _script]) => SUSPICIOUS_INSTALL_SCRIPTS.includes(hook))
      .map(([_hook, script]) => script)
      .join("; ");
    uninstallScript = Object.entries(scripts)
      .filter(([hook, _script]) => SUSPICIOUS_UNINSTALL_SCRIPTS.includes(hook))
      .map(([_hook, script]) => script)
      .join("; ");
  }

  const id = getVersionId(name, version);
  versionCsv.write([
    id,
    version.trim(),
    timestamp,
    cleanedRepo,
    fileCount,
    unpackedSize,
    installScript,
    uninstallScript,
  ]);
  versionOfCsv.write([id, packageId]);

  return id;
};

export const saveDependencies = (
  name: string,
  version: string,
  dependencies: StringMap,
  type: DependencyType
) => {
  const versionId = getVersionId(name, version);
  Object.entries(dependencies)
    .filter(([depName, depRange]) => !!depName && !!depRange)
    .forEach(([depName, depRange]) => {
      const requirementId = saveVersionRequirement(
        depName,
        depRange,
        name,
        version
      );
      dependsOnCsv.write([versionId, type, requirementId]);
    });
};

export const saveMaintainer = (versionId: string, maintainer: Maintainer) => {
  // Sometimes each maintainer is a {name: "...", email: "..."} object,
  // other times it's just a string.
  let username: string;
  let email: string;
  if (typeof maintainer === "object" && "name" in maintainer) {
    username = maintainer["name"];
    email = maintainer["email"];
  } else if (typeof maintainer === "string") {
    username = maintainer;
  } else {
    return;
  }
  if (!!username) {
    const userId = saveUser(username, email);
    maintainsCsv.write([userId, versionId]);
  }
};

export const saveNextVersions = (
  name: string,
  versions: StringMap,
  times: StringMap
) => {
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

export const saveResolvesTo = (
  vrId: number,
  name: string,
  range: string,
  dependents: Dependent[]
) => {
  const versions = packageVersions.get(name);
  if (!versions || versions.length === 0 || !name || !vrId) {
    return;
  }
  const tags = packageTags.get(name);
  let resolvedVersion: string;
  if (range in tags) {
    // e.g. if the range is "latest" or "alpha"
    resolvedVersion = tags[range];
  } else {
    resolvedVersion = resolveVersionRequirement(versions, range);
  }

  if (!!resolvedVersion) {
    const versionId = getVersionId(name, resolvedVersion);
    resolvesToCsv.write([vrId, versionId]);
    dependents.forEach(({ name: dependentName, version: dependentVersion }) => {
      const dependentId = getVersionId(dependentName, dependentVersion);
      dependsOnResolvesToCsv.write([dependentId, versionId]);
    });
  }
};
