import TrieMap from "mnemonist/trie-map";
import { VersionRequirement, StringMap } from "./types";
import Trie from "mnemonist/trie";

class DefaultTrieMap {
  public trieMap: TrieMap<string, VersionRequirement>;
  public constructor() {
    this.trieMap = new TrieMap();
  }

  public set = (key: string, vrId: number, dependencyName: string, range: string, dependentName: string, dependentVersion: string) => {
    if (this.trieMap.has(key)) {
      const {dependents} = this.trieMap.get(key);
      dependents.push({name: dependentName, version: dependentVersion})
    } else {
      const versionRequirement = {
        id: vrId,
        package: dependencyName,
        range,
        dependents: [{name: dependentName, version: dependentVersion}]
      }
      this.trieMap.set(key, versionRequirement)
    }
  }

  public get = (key: string) => (this.trieMap.get(key))

  public has = (key: string) => (this.trieMap.has(key))
}

// {name--range => {id: version requirement ID, name: name, range: range}}
export const versionRequirements = new DefaultTrieMap();
// {name => list of versions}
export const packageVersions = new TrieMap<string, string[]>();
// {name => {tag: version}}
export const packageTags = new TrieMap<string, StringMap>()
// {set of all packages saved thus far}
export const packages = new Trie<string>();
// {set of all users saved thus far}
export const users = new Trie<string>();
