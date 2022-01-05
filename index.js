const path = require('path');
const Franchise = require('madden-franchise');

// TEST THE COMPARISON =======================================================================================
const { createHash } = require('crypto');

let franchise1 = new Franchise('C:\\Users\\Matt\\Documents\\Madden NFL 22\\saves\\CAREER-COMPARETEST');
let franchise2 = new Franchise('C:\\Users\\Matt\\Documents\\Madden NFL 22\\saves\\CAREER-COMPARETEST-AUTOSAVE');

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
        const f2Table = franchise2.getTableById(table.header.tableId);
    
        if (f2Table) {
            const file2Hash = getHashFromBuffer(f2Table.data);
    
            if (file1Hash !== file2Hash) {
                changedTables.push(table.header.tableId);   
            }
        } else {
            console.log(`Table (${table.header.tableId}) ${table.name} does not exist in the 2nd file.`);
        }
    });
    
    for (const tableId of changedTables) {
        const f1Table = franchise1.getTableById(tableId);
        const f2Table = franchise2.getTableById(tableId);
    
        await Promise.all([f1Table.readRecords(), f2Table.readRecords()]);
    
        console.log(`(${f1Table.header.tableId}) ${f1Table.name}`);

        const f1HeaderHash = getHashFromBuffer(f1Table.data.slice(0, f1Table.header.headerSize));
        const f2HeaderHash = getHashFromBuffer(f2Table.data.slice(0, f2Table.header.headerSize));

        if (f1HeaderHash !== f2HeaderHash) {
            console.log(`\tHeaders are different.`);
            
            Object.keys(f1Table.header).forEach((key) => {
                if (f1Table.header[key] !== f2Table.header[key]) {
                    console.log(`\t\t${key}\n\t\t\tFile 1: ${f1Table.header[key]}\n\t\t\tFile 2: ${f2Table.header[key]}`);
                }
            });
        }

        f1Table.arraySizes.forEach((arraySize, index) => {
            const f2ArraySize = f2Table.arraySizes[index];
            if (arraySize !== f2ArraySize) {
                console.log(`\tRecord #${index}: Array size is different.\n\t\tFile 1: ${arraySize}\n\t\tFile 2: ${f2ArraySize}`);
            }
        })
    
        f1Table.records.forEach((record) => {
            const file1Hash = getHashFromBuffer(record.hexData);
            
            const f2Record = f2Table.records[record.index];

            if (f2Record) {
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
            }
            else {
                console.log(`\tRecord #${record.index} does not exist in the 2nd file.`);
            }
        });
    
        console.log('');
    }
};

function getHashFromBuffer(buf) {
    const hash = createHash('sha256');
    hash.update(buf);
    return hash.digest('hex');
};