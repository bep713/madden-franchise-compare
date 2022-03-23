const FranchiseFile = require('madden-franchise');
const compare = require('./compare');

(async () => {
    const basePath = 'D:\\Projects\\Madden 22\\Update issue\\Copy Old\\Franchise-Tuning-binaryPATCH.FTC';
    const fileToCopyPath = 'D:\\Projects\\Madden 22\\Update issue\\Copy Old\\Franchise-Tuning-binaryPREPATCH.FTC';
    const outputPath = 'D:\\Projects\\Madden 22\\Update issue\\Copy Old\\Franchise-Tuning-binaryMERGED.FTC';

    const changes = await compare(basePath, fileToCopyPath, {
        ignoreSchema: true,
        smartReferences: true
    });

    const intArrayTableChanges = changes.filter((change) => {
        return change.table === 'int[]';
    });

    const patchFranchise = new FranchiseFile(basePath);
    
    const changePromises = intArrayTableChanges.map(async (change) => {
        const table = patchFranchise.getTableById(change.file1TableId);

        try {
            await table.readRecords();
        }
        catch (err) {
            console.error(err);
        }

        change.recordDiffs.forEach((recordChange) => {
            recordChange.fieldDiffs.forEach((fieldChange) => {
                table.records[recordChange.index][fieldChange.key] = fieldChange.file2;
            });
        });
    });
    
    await Promise.all(changePromises);
    await patchFranchise.save(outputPath);
})();