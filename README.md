### Usage
This tool is helpful when comparing two Madden franchise files (supports game saves or FTCs). As a developer tool, it is very handy to see what all has changed when you are trying to mod something.

`frandiff.exe compare <base franchise file path> <compare franchise file path>` for basic operation. This will scan each file and create a list of changes saved to `frandiff.txt`.

#### Minimal output
Use the option `-m` to toggle minimal output. This will show only the table and table IDs that have changed. It will not show any diffs. Helpful to see an overview of what has changed.

#### Smart references
Use the option `--smart-references` to have the app check if the reference points to the same field in both files. If so, a change will not be logged. 

Ex: the Team table changed from table ID 7000 to 7001. All references to the Team table would have changed from 7000 to 7001 in file 2, triggering many changes even though they actually point to the same record as before. With this option set, these changes will not be logged.

#### Ignore schema
Use the option `--ignore-schema` to ignore changes to the table header's schemaMajor and schemaMinor. This is helpful when comparing two files that have different schemas, because otherwise every table would show as changed.

#### Ignore header
Use the option `--ignore-header` to ignore header attribute changes. This is useful if you only want to see fields that are different.

#### Ignore fields
Use the option `--ignore-fields` to ignore field changes. This is useful if you do not want a large text file and only want to see the header data that has changed.

#### Table option
Use the option `--table <tableName>` to only look at tables with the passed-in name. Useful for looking at one table without having to scroll through a huge list of diffs.

#### Schema directory
Use the option `-s <path>` to have the app use a custom directory of franchise file schemas. Useful if you use the Madden Franchise Editor and have new schemas that this app does not have. The franchise editor schemas will be in %APPDATA%\madden-franchise-editor\schemas.

#### Output
Use the option `--output <path>` to customize where the output .txt file is sent.