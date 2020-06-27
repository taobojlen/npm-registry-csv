import gh from "github-url-to-object";
import { Dependency, DependencyType, Version, StringMap } from "./types";
import { concat } from "lodash";

export const normalizeRepo = (repository?: string ) => {
  // Only handles GitHub repos but these make up ~98% of
  // npm packages, according to
  // https://github.com/nice-registry/all-the-package-repos
  let normalizedRepo: gh.Result;
  let cleanedRepo = "";

  try {
    if (typeof repository === "string") {
      normalizedRepo = gh(repository);
    } else if (
      typeof repository === "object" &&
      !!repository &&
      "url" in repository &&
      !!repository["url"]
    ) {
      normalizedRepo = gh(repository["url"]);
    }
    if (!!normalizedRepo) {
      cleanedRepo = normalizedRepo.https_url;
    }
  } catch {
    console.error(`Failed to parse repo ${repository}`);
  }
  return cleanedRepo.trim();
};

export const parseDependencies = (
  normalDeps?: StringMap,
  devDeps?: StringMap,
  peerDeps?: StringMap
): Dependency[] => {
  const toDependency = (
    deps: StringMap,
    type: DependencyType
  ): Dependency[] => {
    if (!deps) {
      return [];
    }
    return Object.entries(deps)
      .filter(([depName, depRange]) => !!depName && !!depRange)
      .map(
        ([depName, depRange]): Dependency => ({
          package: depName.trim(),
          range: depRange.trim(),
          type: type,
        })
      );
  };

  return concat(
    toDependency(normalDeps, "normal"),
    toDependency(devDeps, "dev"),
    toDependency(peerDeps, "peer")
  ).filter((d) => !!d);
};

const getUsername = (maintainer: any) => {
  // Sometimes each maintainer is a {name: "...", email: "..."} object,
  // other times it's just a string.
  let username = "<UNKNOWN_USER>";
  if (typeof maintainer === "object" && "name" in maintainer) {
    username = maintainer["name"];
  } else if (typeof maintainer === "string") {
    username = maintainer;
  }

  return username.trim();
};

export const parseVersion = (
  version: string,
  versionDetails: any,
  times: StringMap,
  packageTagsForVersion: StringMap
): Version => {
  if (!versionDetails) {
    return;
  }

  // Compile dependencies
  const dependencies = parseDependencies(
    versionDetails["dependencies"],
    versionDetails["devDependencies"],
    versionDetails["peerDependencies"]
  );

  // Compile maintainers
  const maintainersRaw = versionDetails["maintainers"];
  let maintainers = [];
  if (!!maintainersRaw && Array.isArray(maintainersRaw)) {
    maintainers = maintainersRaw.map(getUsername);
  } else if (!!maintainersRaw) {
    console.log(maintainersRaw);
    // TODO
    // maintainers = Object.entries(maintainersRaw).map(getUsername)
  }

  const versionObject: Version = {
    version,
    timestamp: !!times && times[version],
    maintainers,
    dependencies,
    repository: normalizeRepo(versionDetails["repository"]),
    fileCount: versionDetails["dist"] && versionDetails["dist"].fileCount,
    unpackedSize: versionDetails["dist"] && versionDetails["dist"].unpackedSize,
    tag: packageTagsForVersion[version],
  };
  return versionObject;
};

export const swapKeysAndValues = (map: StringMap) => {
  return Object.entries(map).reduce((acc, entry: [string, string]) => {
    const [key, value] = entry;
    acc[value] = key;
    return acc;
  }, {});
};
