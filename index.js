const { program } = require('commander');
const compareTool = require('./src/compare');

program
    .name('FranDiff')
    .description('Compares two franchise files (saves or FTCs) for changes.')
    .version('0.5')

program.command('compare')
    .description('Compares two files for changes.')
    .option('-s, --schema-directory <path>', 'use a path to a custom schema directory')
    .option('-m, --minimal-output', 'output only the table name and table IDs that have changed. Do not show diffs.')
    .option('--table <tableName>', 'Show diffs only for a certain table name (may have multiple hits per file)')
    .option('--ignore-schema', 'do not detect changes to the table header schema major and minor.')
    .option('--ignore-header', 'do not detect changes to the table header at all.')
    .option('--ignore-fields', 'do not detect changes to the table fields at all.')
    .option('--smart-references', 'do not detect updates to reference table IDs. Only detect when the table and/or row index changes.')
    .option('--output <outputPath>', 'specify where to place the output. Default: diff.txt')
    .argument('<base franchise file path>', 'the filepath to the base franchise file.')
    .argument('<compare franchise file path>', 'the filepath to the franchise file to compare.')
    .action(async (inputPath, outputPath, options) => {
        await compareTool(inputPath, outputPath, options);
    });

(async () => {
    await program.parseAsync(process.argv);
})();
