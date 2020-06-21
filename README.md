# npm-registry-csv

```
$ npx npm-registry-csv
```

This script lets you download data about the npm registry (packages, their versions, maintainers, and dependencies)
and store it as .csv files for easy import into e.g. Neo4j.

# Requirements

The script downloads a large JSON file from npm (~45GB as of 2020-06-18) and parses it.
As far as I can tell, npm throttles the download, so the first requirements are (a) time and (b) ample disk space.

The data is processed using streams, but it does need to save a lot of information in memory. With the 45GB JSON file it uses about 3GB of RAM.

# Data modeling

There are five node types with the following properties:

- Registry
  - `id`. There's just one node of this type with id `npm`.
  - `last_update_check`. This is equivalent to the current revision in npm's database. This makes it easy to get incremental updates to the graph (though this script does not handle this).
- Package
  - `id` (this is just the package name prefixed with `npm-`.)
  - `name`
- Version
  - `version`
  - `timestamp`
- VersionRequirement
  - `requirement` (e.g. `^2.0.0` or `>=5.0.1`)
- User
  - `username`

And several relationships:

- `(Version)--[VERSION_OF]-->(Package)`
- `(Version)--[DEPENDS_ON]-->(VersionRequirement)`
  - Has property `type` which is one of `normal`, `dev`, `peer`
- `(VersionRequirement)--[REQUIREMENT_OF]-->(Package)`
- `(VersionRequirement)--[RESOLVES_TO]-->(Version)`
- `(User)--[MAINTAINS]-->(Version)`
- `(Package)--[IN_REGISTRY]-->(Registry)`
