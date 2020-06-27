import { versionRequirements, packageVersions } from "./inMemoryData";
import cliProgress from "cli-progress";
import { saveResolvesTo } from "./save";

export const resolveVersions = () => {
  const total = versionRequirements.trieMap.size;
  let idx = 0;
  const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  bar.start(total, 0);
  for (let vr of versionRequirements.trieMap) {
    if (idx % 10000 === 0) {
      bar.update(idx);
    }
    const { id, package: name, range, dependents } = vr[1];
    saveResolvesTo(id, name, range, dependents)
    idx += 1;
  }
  bar.stop();
};
