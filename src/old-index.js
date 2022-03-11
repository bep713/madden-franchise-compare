const path = require('path');
const Franchise = require('madden-franchise');

// TEST THE COMPARISON =======================================================================================
const { createHash } = require('crypto');

let franchise1 = new Franchise('D:\\Projects\\Madden 22\\FranTkData\\Franchise-Tuning-binary.FTC');
let franchise2 = new Franchise('C:\\Users\\Matt\\Downloads\\Franchise-Tuning-binary.FTC');

let changedTables = [];

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

compareFiles();

async function compareFiles() {
    await Promise.all([f1Promise, f2Promise]);
    
    franchise1.tables.forEach((table) => {
        // Get hash for table in file 1
        const file1Hash = getHashFromBuffer(table.data);
    
        // Get hash for table in file 2
        const f2Table = getTableByPad1(franchise2.tables, table.header.tablePad1);

        if (f2Table) {
            const file2Hash = getHashFromBuffer(f2Table.data);
    
            if (file1Hash !== file2Hash) {
                changedTables.push(table.header.tableId);   
            }
        } else {
            console.log(`Table (${table.header.tableId}) ${table.name} does not exist in the 2nd file.`);
        }
    });

    let changes = [];
    
    for (const tableId of changedTables) {
        const f1Table = franchise1.getTableById(tableId);
        const f2Table = getTableByPad1(franchise2.tables, f1Table.header.tablePad1);

        let change = {
            table: f1Table.name,
            tableId: tableId  
        };
    
        try {
            await Promise.all([f1Table.readRecords(), f2Table.readRecords()]);
        }
        catch (err) {
            console.log(`(${tableId}) ${f1Table.name} - problem reading the table. Err: ${err}`);
        }
    
        console.log(`(${f1Table.header.tableId}) ${f1Table.name}`);

        const f1HeaderHash = getHashFromBuffer(f1Table.data.slice(0, f1Table.header.headerSize));
        const f2HeaderHash = getHashFromBuffer(f2Table.data.slice(0, f2Table.header.headerSize));

        if (f1HeaderHash !== f2HeaderHash) {
            change.headerDiffs = {};

            console.log(`\tHeaders are different.`);
            
            Object.keys(f1Table.header).forEach((key) => {
                if (f1Table.header[key] !== f2Table.header[key]) {
                    change.headerDiffs[key] = {
                        file1: f1Table.header[key],
                        file2: f2Table.header[key]
                    };

                    console.log(`\t\t${key}\n\t\t\tFile 1: ${f1Table.header[key]}\n\t\t\tFile 2: ${f2Table.header[key]}`);
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

                console.log(`\tRecord #${index}: Array size is different.\n\t\tFile 1: ${arraySize}\n\t\tFile 2: ${f2ArraySize}`);
            }
        })

        change.recordDiffs = [];
    
        f1Table.records.forEach((record) => {
            const file1Hash = getHashFromBuffer(record.hexData);
            
            const f2Record = f2Table.records[record.index];

            if (f2Record) {
                const file2Hash = getHashFromBuffer(f2Record.hexData);
        
                if (file1Hash !== file2Hash) {
                    console.log(`\tRecord #${record.index}`);

                    const fieldDiffs = {};
        
                    record.fields.forEach((field, index) => {
                        const f2Field = f2Record.fields[index];
        
                        if (field.value !== f2Field.value) {
                            fieldDiffs[field.key] = {
                                file1: field.value,
                                file2: f2Field.value
                            };

                            console.log(`\t\tField: ${field.key}\n\t\t\tFile 1: ${field.value}\n\t\t\tFile 2: ${f2Field.value}`);
                        }
                    });

                    change.recordDiffs.push(fieldDiffs);
                }
            }
            else {
                console.log(`\tRecord #${record.index} does not exist in the 2nd file.`);
            }
        });
    
        console.log('');

        changes.push(change);
    }

    const tablesWithRecordDiffs = changes.filter((change) => {
        return change.recordDiffs.length > 0;
    });

    console.log(tablesWithRecordDiffs);
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