const utilService = require('madden-franchise/services/utilService');

(async () => {
    const path = require('path');
    const Franchise = require('madden-franchise');
    
    let franchise = new Franchise('C:\\Users\\Matt\\Documents\\Madden NFL 22\\saves\\CAREER-COMPARETEST');
    await new Promise((resolve, reject) => {
        franchise.on('ready', () => {
            resolve();
        });
    });

    const tableIdToSearch = 4272;
    const recordIndexToSearch = 0;

    const referenceBinary = utilService.dec2bin(tableIdToSearch, 15);
    const recordIndexBinary = utilService.dec2bin(recordIndexToSearch, 17);
    const fullBinary = referenceBinary + recordIndexBinary;
    const hex = utilService.bin2hex(fullBinary);

    const referencingTables = franchise.tables.filter((table) => {
        return table.data.indexOf(hex, 0, 'hex') !== -1;
    });

    referencingTables.forEach((table) => {
        console.log(`(${table.header.tableId}) ${table.name}`);
    });
})();