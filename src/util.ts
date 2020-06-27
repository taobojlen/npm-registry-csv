import { StringMap } from "./types";
import semver from "semver";

export const swapKeysAndValues = (map: StringMap) => {
  if (!map) {
    return {}
  }
  return Object.entries(map).reduce((acc, entry) => {
    const [key, value] = entry;
    acc[value] = key;
    return acc;
  }, {});
};

export class Counter {
  private count: number;

  constructor() {
    this.count = 0;
  }

  next() {
    this.count += 1;
    return this.count;
  }
}

export const getVersionId = (name: string, version: string): string => {
  try {
    return `${name.trim()}--${version.trim()}`;
  } catch {
    console.error(name);
    console.error(version);
  }
};

export const resolveVersionRequirement = (versions: string[], range: string) => {
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
