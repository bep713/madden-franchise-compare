const path = require('path');
const Franchise = require('madden-franchise');

// TEST THE COMPARISON =======================================================================================
const { createHash } = require('crypto');

let franchise1 = new Franchise('C:\\Users\\Matt\\Documents\\Madden NFL 22\\saves\\CAREER-COMPARETEST');
let franchise2 = new Franchise('C:\\Users\\Matt\\Documents\\Madden NFL 22\\saves\\CAREER-COMPARETEST-AUTOSAVE');

let hashTables = {};
let changedTables = [];

franchise2.on('ready', async () => {
    franchise1.tables.forEach((table) => {
        // Get hash for table in file 1
        const file1Hash = getHashFromBuffer(table.data);

        // Get hash for table in file 2
        const f2Table = franchise2.getTableById(table.header.tableId);

        if (f2Table) {
            const file2Hash = getHashFromBuffer(f2Table.data);
    
            if (file1Hash !== file2Hash) {
                changedTables.push(table.header.tableId);   
            }
        } else {
            console.log(`Table ${table.name} does not exist in the 2nd file.`);
        }
    });

    for (const tableId of changedTables) {
        const f1Table = franchise1.getTableById(tableId);
        const f2Table = franchise2.getTableById(tableId);

        await Promise.all([f1Table.readRecords(), f2Table.readRecords()]);

        console.log(`${f1Table.name} - ${f1Table.header.tableId}`);

        f1Table.records.forEach((record) => {
            const file1Hash = getHashFromBuffer(record.hexData);
            
            const f2Record = f2Table.records[record.index];
            const file2Hash = getHashFromBuffer(f2Record.hexData);

            if (file1Hash !== file2Hash) {
                console.log(`\tRecord #${record.index}`);

                record.fields.forEach((field, index) => {
                    const f2Field = f2Record.fields[index];

                    if (field.value !== f2Field.value) {
                        console.log(`\t\tField: ${field.key}\n\t\t\tFile 1: ${field.value}\n\t\t\tFile 2: ${f2Field.value}`);
                    }
                });
            }
        });

        console.log('');
    }
});

function getHashFromBuffer(buf) {
    const hash = createHash('sha256');
    hash.update(buf);
    return hash.digest('hex');
};