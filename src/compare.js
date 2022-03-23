const fs = require('fs');
const { createLogger, format, transports } = require('winston');
const { createHash } = require('crypto');

const Franchise = require('madden-franchise');
const utilService = require('madden-franchise/services/utilService');

module.exports = async (basePath, comparePath, options) => {
    let outputPath = options.output ? options.output : 'frandiff.txt';

    const loggerFormat = format.combine(
        format.colorize(),
        format.printf(
            (info) => {
                return `${info.message}`;
            }
        )
    );

    const logger = createLogger({
        level: 'info',
        format: loggerFormat,
        transports: [
            new transports.File({ filename: outputPath, options: { flags: 'w' } })
        ]
    });

    if (options.showConsole) {
        logger.add(new transports.Console({
            format: loggerFormat
        }));
    }

    let franchiseOptions = {};

    if (options.schemaDirectory) {
        franchiseOptions.schemaDirectory = options.schemaDirectory;
    }
    
    let changedTables = [];

    let franchise1 = new Franchise(basePath, franchiseOptions);
    let franchise2 = new Franchise(comparePath, franchiseOptions);

    let f1Promise = new Promise((resolve, reject) => {
        franchise1.on('ready', () => {
            resolve();
        });
    });
    
    let f2Promise = new Promise((resolve, reject) => {
        franchise2.on('ready', () => {
            resolve();
        });
    });

    return compareFiles();

    async function compareFiles() {
        console.log('Loading files...');

        let changes = [];
        let tableIdMap = [];
        let errorTables = [];
        let missingTables = [];
        let uncheckedTables = [];

        await Promise.all([f1Promise, f2Promise]);
        
        franchise1.tables.forEach((table) => {
            // Get hash for table in file 1
            const file1Hash = getHashFromBuffer(table.data);

            // Rename the first table if it's null so that it shows properly
            // in a text editor.
            if (table.name === '\u0000') {
                table.name = ' ';
            }

            // Dynamically generated tables created by the game
            // will not have a unique id, so we have no way to track them.
            if (table.header.tablePad1 === 0) {
                uncheckedTables.push(table);
                return;
            }
        
            // Get hash for table in file 2
            const f2Table = getTableByPad1(franchise2.tables, table.header.tablePad1);

            let tableIdMapEntry = {
                id: table.header.tablePad1,
                name: table.name,
                file1TableId: table.header.tableId
            };

            if (f2Table) {
                tableIdMapEntry.file2TableId = f2Table.header.tableId;
                
                const file2Hash = getHashFromBuffer(f2Table.data);
                
                if (file1Hash !== file2Hash) {
                    changedTables.push(table.header.tableId);   
                }
            } else {
                missingTables.push(tableIdMapEntry);
                // logger.info(`Table (${table.header.tableId}) ${table.name} does not exist in the 2nd file.`);
            }

            tableIdMap.push(tableIdMapEntry);
        });

        console.log('Detecting changes...');

        let headerKeysToIgnore = ['tableId', 'data1TableId'];

        if (options.ignoreSchema) {
            headerKeysToIgnore.push('data1Type');
            headerKeysToIgnore.push('data1Unknown1');
        }

        const tablesToCheckForChanges = changedTables.filter((tableId) => {
            return !(missingTables.find((missingTable) => {
                return missingTable.file1TableId === tableId;
            }));
        });
        
        for (const tableId of tablesToCheckForChanges) {
            const f1Table = franchise1.getTableById(tableId);
            const f2Table = getTableByPad1(franchise2.tables, f1Table.header.tablePad1);

            let change = {
                table: f1Table.name,
                file1TableId: tableId,
                file2TableId: f2Table.header.tableId
            };
        
            try {
                await Promise.all([f1Table.readRecords(), f2Table.readRecords()]);
            }
            catch (err) {
                // logger.info(`(${tableId}) ${f1Table.name} - problem reading the table. Err: ${err}`);
                errorTables.push({
                    name: f1Table.name,
                    tableId: tableId,
                    err: err
                });
            }
        
            // logger.info(`${f1Table.name}\n\tFile 1 table id: ${tableId}\n\tFile 2 table id: ${f2Table.header.tableId}`);

            if (!options.ignoreHeader) {
                const f1HeaderHash = getHashFromBuffer(f1Table.data.slice(0, f1Table.header.headerSize));
                const f2HeaderHash = getHashFromBuffer(f2Table.data.slice(0, f2Table.header.headerSize));
    
                change.headerDiffs = [];
                
                if (f1HeaderHash !== f2HeaderHash) {

                    Object.keys(f1Table.header).filter((key) => {
                       return headerKeysToIgnore.indexOf(key) < 0;
                    }).forEach((key) => {
                        if (f1Table.header[key] !== f2Table.header[key]) {
                            change.headerDiffs.push({
                                field: key,
                                file1: f1Table.header[key],
                                file2: f2Table.header[key]
                            });
    
                            // logger.info(`\t\t${key}\n\t\t\tFile 1: ${f1Table.header[key]}\n\t\t\tFile 2: ${f2Table.header[key]}`);
                        }
                    });
                }
    
                change.arraySizeDiffs = [];
    
                f1Table.arraySizes.forEach((arraySize, index) => {
                    const f2ArraySize = f2Table.arraySizes[index];
                    if (arraySize !== f2ArraySize) {
                        change.arraySizeDiffs.push({
                            index: index,
                            file1: arraySize,
                            file2: f2ArraySize
                        });
    
                        // logger.info(`\tRecord #${index}: Array size is different.\n\t\tFile 1: ${arraySize}\n\t\tFile 2: ${f2ArraySize}`);
                    }
                });
            }

            if (!options.ignoreFields) {
                change.recordDiffs = [];
            
                f1Table.records.forEach((record) => {
                    const file1Hash = getHashFromBuffer(record.hexData);
                    const f2Record = f2Table.records[record.index];
    
                    if (f2Record) {
                        const file2Hash = getHashFromBuffer(f2Record.hexData);
                
                        if (file1Hash !== file2Hash) {
                            // logger.info(`\tRecord #${record.index}`);
    
                            const fieldDiffs = [];
                
                            record.fields.forEach((field, index) => {
                                const f2Field = f2Record.fields[index];
                                let isDifferent = false;
                
                                if (field.value !== f2Field.value) {
                                    if (field.isReference && options.smartReferences) {
                                        const f1Reference = utilService.getReferenceData(field.value);
                                        const f2Reference = utilService.getReferenceData(f2Field.value);

                                        const f1TableReference = tableIdMap.find((table) => {
                                            return table.file1TableId === f1Reference.tableId;
                                        });

                                        const f2TableReference = tableIdMap.find((table) => {
                                            return table.file2TableId === f2Reference.tableId;
                                        });

                                        if (f1TableReference !== f2TableReference
                                            || f1Reference.rowNumber !== f2Reference.rowNumber) {
                                            isDifferent = true;
                                        }
                                    }
                                    else {
                                        isDifferent = true;
                                    }

                                    if (isDifferent) {
                                        let file1Value = field.value;
                                        let file2Value = f2Field.value;

                                        if (field.isReference) {
                                            const f1Reference = utilService.getReferenceData(field.value);
                                            const f2Reference = utilService.getReferenceData(f2Field.value);

                                            file1Value += ` (ID: ${f1Reference.tableId}, Row: ${f1Reference.rowNumber})`;
                                            file2Value += ` (ID: ${f2Reference.tableId}, Row: ${f2Reference.rowNumber})`;
                                        }

                                        fieldDiffs.push({
                                            key: field.key,
                                            file1: file1Value,
                                            file2: file2Value
                                        });
                                    }
                                    
                                    // logger.info(`\t\tField: ${field.key}\n\t\t\tFile 1: ${field.value}\n\t\t\tFile 2: ${f2Field.value}`);
                                }
                            });
    
                            if (fieldDiffs.length > 0) {
                                change.recordDiffs.push({
                                    index: record.index,
                                    fieldDiffs: fieldDiffs,
                                    existsInSecondFile: true
                                });
                            }
                        }
                    }
                    else {
                        change.recordDiffs.push({
                            index: record.index,
                            existsInSecondFile: false
                        });
                        // logger.info(`\tRecord #${record.index} does not exist in the 2nd file.`);
                    }
                });
            
                // logger.info('');
            }

            changes.push(change);

            f1Table.records = null;
            f2Table.records = null;
        }

        console.log('Building output file...');

        logger.info(`*** FranDiff ***`);
        logger.info(`*** File 1: ${basePath} ***`);
        logger.info(`*** File 2: ${comparePath} ***`);

        const filteredChanges = changes.filter((change) => {
            let showChange = false;

            if (options.table) {
                if (change.table === options.table) {
                    showChange = true;
                }
            }
            else {
                if (!options.ignoreHeader && (change.arraySizeDiffs.length > 0 || Object.keys(change.headerDiffs).length > 0)) {
                    showChange = true;
                }
    
                if (!showChange && !options.ignoreFields && change.recordDiffs.length > 0) {
                    showChange = true;
                }
            }

            return showChange;
        });

        if (options.table) {
            logger.info(`*** Filtering results for tables with the name ${options.table}. ***`)
        }

        if (options.ignoreHeader) {
            logger.info(`*** Ignoring table headers. ***`);
        }

        if (options.ignoreFields) {
            logger.info(`*** Ignoring table fields. ***`);
        }

        if (options.ignoreSchema) {
            logger.info(`*** Ignoring schema differences in table headers. ***`);
        }

        if (options.minimalOutput) {
            logger.info(`*** Showing minimal output. ***`);
        }

        if (options.smartReferences) {
            logger.info(`*** Using smart references. ***`);
        }

        if (errorTables.length > 0) {
            logger.info(`\n*** Errors (${errorTables.length} total) ***`);

            errorTables.forEach((table) => {
                logger.info(`(${table.tableId}) ${table.name} - problem reading the table. Err: ${table.err}`);
            });
        }

        if (missingTables.length > 0) {
            logger.info(`\n*** Missing tables (${missingTables.length} total) ***`);
    
            missingTables.forEach((table) => {
                logger.info(`Table (${table.file1TableId}) ${table.name} does not exist in file 2.`);
            });
        }

        if (uncheckedTables.length > 0) {
            logger.info(`\n*** Unchecked tables (${uncheckedTables.length} total) ***`);

            uncheckedTables.forEach((table) => {
                logger.info(`Table (${table.header.tableId}) ${table.name} - no unique ID found.`);
            });
        }

        logger.info(`\n*** Changes (${filteredChanges.length} total) ***`);

        filteredChanges.forEach((change) => {
            logger.info(`\n${change.table}\n\tTable ID:\n\t\tFile 1: ${change.file1TableId}\n\t\tFile 2: ${change.file2TableId}`);

            if (!options.ignoreHeader && !options.minimalOutput && change.headerDiffs.length > 0) {
                logger.info(`\tHeader Diffs:`);

                change.headerDiffs.forEach((diff) => {
                    logger.info(`\t\t${diff.field}\n\t\t\tFile 1: ${diff.file1}\n\t\t\tFile 2: ${diff.file2}`);
                });

                if (change.arraySizeDiffs.length > 0) {
                    logger.info(`\tArray Size Diffs:`)
                    change.arraySizeDiffs.forEach((diff) => {
                        logger.info(`\t\tRecord #${diff.index}:\n\t\t\tFile 1: ${diff.file1}\n\t\t\tFile 2: ${diff.file2}`);
                    });
                }
            }

            if (!options.ignoreFields && !options.minimalOutput && change.recordDiffs.length > 0) {
                logger.info(`\tRecord Diffs:`);

                change.recordDiffs.forEach((recordDiff) => {
                    if (!recordDiff.existsInSecondFile) {
                        logger.info(`\t\tRecord #${recordDiff.index} does not exist in File #2.`);
                    }
                    else {
                        logger.info(`\t\tRecord #${recordDiff.index}:`);

                        recordDiff.fieldDiffs.forEach((fieldDiff) => {
                            logger.info(`\t\t\tField: ${fieldDiff.key}\n\t\t\t\tFile 1: ${fieldDiff.file1}\n\t\t\t\tFile 2: ${fieldDiff.file2}`);
                        });
                    }
                });
            }
        });

        console.log(`Done.\nOutput saved to ${outputPath}`);
        return filteredChanges;
    };

    function getHashFromBuffer(buf) {
        const hash = createHash('sha256');
        hash.update(buf);
        return hash.digest('hex');
    };

    function getTableByPad1(tables, pad1) {
        return tables.find((table) => {
            return table.header.tablePad1 === pad1;
        });
    };
};