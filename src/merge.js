const Franchise = require('madden-franchise');
const { createLogger, format, transports } = require('winston');
const utilService = require('madden-franchise/services/utilService');

const compare = require('./compare');

module.exports = async (basePath, newestPath, options) => {
    let outputPath = options.output ? options.output : 'Merged';
    let logOutput = options.logOutput ? options.logOutput : 'mergelog.txt';

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
            new transports.File({ filename: logOutput, options: { flags: 'w' } })
        ]
    });

    if (options.showConsole) {
        logger.add(new transports.Console({
            format: loggerFormat
        }));
    }

    let comparePath = options.modified ? options.modified : basePath;

    options.realOutput = options.output;
    options.output = 'frandiff.txt';

    logger.info(`Comparing ${newestPath} to ${comparePath}...`);
    const changes = await compare(newestPath, comparePath, options);
    logger.info(`Done comparing.`);

    options.output = options.realOutput;

    const filteredTableChanges = options.tableName ? changes.filter((change) => {
        return change.table === options.tableName;
    }) : changes;

    const patchFranchise = new Franchise(newestPath, {
        schemaDirectory: options.schemaDirectory
    });

    await new Promise((resolve, reject) => {
        patchFranchise.on('ready', () => {
            resolve();
        });
    });
    
    logger.info(`Updating data and saving to ${outputPath}...`);
    const changePromises = filteredTableChanges.filter((change) => {
        return change.recordDiffs.length > 0;
    }).map(async (change) => {
        const table = patchFranchise.getTableByUniqueId(change.uniqueId);

        try {
            await table.readRecords();
        }
        catch (err) {
            console.error(err);
        }

        logger.info(`\nTable: ${table.name} (ID: ${table.header.tableId}, UniqueID: ${change.uniqueId})`);
        change.recordDiffs.forEach((recordChange) => {
            logger.info(`\tRecord Change: ${recordChange.index}`);

            recordChange.fieldDiffs.forEach((fieldChange) => {
                if (table.records[recordChange.index]._fields[fieldChange.key].isReference) {
                    // need to map to the reference table in the new file but keep the same row number as the old file
                    const f1ReferenceData = utilService.getReferenceData(fieldChange.file1);
                    const f2ReferenceData = utilService.getReferenceData(fieldChange.file2);

                    const value = utilService.getBinaryReferenceData(f1ReferenceData.tableId, f2ReferenceData.rowNumber);
                    
                    logger.info(`\t\tSetting ${fieldChange.key} to ${value}.`);
                    table.records[recordChange.index][fieldChange.key] = value;
                }
                else if (!table.records[recordChange.index]._fields[fieldChange.key].offset.valueInSecondTable) {
                    logger.info(`\t\tSetting ${fieldChange.key} to ${fieldChange.file2}.`);
                    table.records[recordChange.index][fieldChange.key] = fieldChange.file2;
                }
                else {
                    logger.info(`\t\tSkipping ${fieldChange.key} because it is a text field.`)
                }
            });
        });
    });
    
    await Promise.all(changePromises);
    await patchFranchise.save(outputPath);
    console.log(`Done. Output saved to ${logOutput}.`);
};