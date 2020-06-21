import fsm from "fs-minipass";
import fs from "fs";
import stringify from "csv-stringify";

const createStringifier = (writeStream, columns) => {
  const stringifier = stringify({ columns: columns, header: true });
  stringifier.pipe(writeStream);
  return stringifier;
};

const createWriteStream = (path) => {
  return new fsm.WriteStreamSync(path);
};

export const createCsvs = () => {
  // Nodes
  const registryPath = "./data/nodes/registry.csv";
  const packagePath = "./data/nodes/package.csv";
  const versionPath = "./data/nodes/version.csv";
  const versionRequirementPath = "./data/nodes/versionRequirement.csv";
  const userPath = "./data/nodes/user.csv";
  // Relationships
  const versionOfPath = "./data/relationships/versionOf.csv";
  const dependsOnPath = "./data/relationships/dependsOn.csv";
  const requirementOfPath = "./data/relationships/requirementOf.csv";
  const resolvesToPath = "./data/relationships/resolvesTo.csv";
  const maintainsPath = "./data/relationships/maintains.csv";
  const inRegistryPath = "./data/relationships/inRegistry.csv";

  const paths = [
    registryPath,
    packagePath,
    versionPath,
    versionRequirementPath,
    userPath,
    versionOfPath,
    dependsOnPath,
    requirementOfPath,
    resolvesToPath,
    maintainsPath,
    inRegistryPath,
  ];
  paths.forEach((path) => {
    if (fs.existsSync(path)) {
      throw new Error(`${path} already exists!`);
    }
  });

  // Create file writers (nodes)
  const registryWriter = createWriteStream(registryPath);
  const packageWriter = createWriteStream(packagePath);
  const versionWriter = createWriteStream(versionPath);
  const versionRequirementWriter = createWriteStream(versionRequirementPath);
  const userWriter = createWriteStream(userPath);
  // Create file writers (relationships)
  const versionOfWriter = createWriteStream(versionOfPath);
  const dependsOnWriter = createWriteStream(dependsOnPath);
  const requirementOfWriter = createWriteStream(requirementOfPath);
  const resolvesToWriter = createWriteStream(resolvesToPath);
  const maintainsWriter = createWriteStream(maintainsPath);
  const inRegistryWriter = createWriteStream(inRegistryPath);

  // Create stringifiers (nodes)
  const registryCsv = createStringifier(registryWriter, [
    "id:ID(Registry)",
    "last_update_check",
  ]);
  const packageCsv = createStringifier(packageWriter, [
    "id:ID(Package)",
    "name",
  ]);
  const versionCsv = createStringifier(versionWriter, [
    "id:ID(Version)",
    "version",
    "timestamp",
  ]);
  const versionRequirementCsv = createStringifier(versionRequirementWriter, [
    "id:ID(VersionRequirement)",
    "requirement",
  ]);
  const userCsv = createStringifier(userWriter, ["id:ID(User)", "username"]);
  // Create stringifiers (relationships)
  const versionOfCsv = createStringifier(versionOfWriter, [
    ":START_ID(Version)",
    ":END_ID(Package)",
  ]);
  const dependsOnCsv = createStringifier(dependsOnWriter, [
    ":START_ID(Version)",
    "type",
    ":END_ID(VersionRequirement)",
  ]);
  const requirementOfCsv = createStringifier(requirementOfWriter, [
    ":START_ID(VersionRequirement)",
    ":END_ID(Package)",
  ]);
  const resolvesToCsv = createStringifier(resolvesToWriter, [
    ":START_ID(VersionRequirement)",
    ":END_ID(Version)",
  ]);
  const maintainsCsv = createStringifier(maintainsWriter, [
    ":START_ID(User)",
    ":END_ID(Version)",
  ]);
  const inRegistryCsv = createStringifier(inRegistryWriter, [
    ":START_ID(Package)",
    ":END_ID(Registry)",
  ]);

  const closeAllCsvs = () => {
    const writers = [
      registryWriter,
      packageWriter,
      versionOfWriter,
      versionRequirementWriter,
      userWriter,
      versionOfWriter,
      dependsOnWriter,
      requirementOfWriter,
      resolvesToWriter,
      maintainsWriter,
      inRegistryWriter,
    ];
    writers.forEach((w) => {
      w.end();
    });
  };

  return {
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
  };
};
