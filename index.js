const { program } = require('commander');
const compareTool = require('./src/compare');
const mergeTool = require('./src/merge');

program
    .name('FranDiff')
    .description('Compares two franchise files (saves or FTCs) for changes and merge changes.')
    .version('1.0')

program.command('compare')
    .description('Compares two files for changes.')
    .option('-s, --schema-directory <path>', 'use a path to a custom schema directory')
    .option('-m, --minimal-output', 'output only the table name and table IDs that have changed. Do not show diffs.')
    .option('--table <tableName>', 'Show diffs only for a certain table name (may have multiple hits per file)')
    .option('--ignore-schema', 'do not detect changes to the table header schema major and minor.')
    .option('--ignore-header', 'do not detect changes to the table header at all.')
    .option('--ignore-fields', 'do not detect changes to the table fields at all.')
    .option('--smart-references', 'do not detect updates to reference table IDs. Only detect when the table and/or row index changes.')
    .option('-o, --output <outputPath>', 'specify where to place the output. Default: diff.txt')
    .argument('<base franchise file path>', 'the filepath to the base franchise file.')
    .argument('<compare franchise file path>', 'the filepath to the franchise file to compare.')
    .action(async (inputPath, outputPath, options) => {
        await compareTool(inputPath, outputPath, options);
    });

program.command('merge')
    .description('Merges up to three files together.\n'
        + 'If base & newest are input: detect any changes between BASE & NEWEST. Merge changes on top of NEWEST.\n'
        + 'If base, newest, and --modified are input: detect any changes between BASE and MODIFIED. Merge changes on top of NEWEST.')
    .option('-s, --schema-directory <path>', 'use a path to a custom schema directory')
    .option('--table <tableName>', 'Merge certain table name (may have multiple hits per file)')
    .option('--ignore-schema', 'do not detect changes to the table header schema major and minor.')
    .option('--ignore-header', 'do not detect changes to the table header at all.')
    .option('--ignore-fields', 'do not detect changes to the table fields at all.')
    .option('--smart-references', 'do not detect updates to reference table IDs. Only detect when the table and/or row index changes.')
    .option('-m, --modified <path>', '[OPTIONAL] the file path, modified from BASE, to detect changes. Changes will be applied on top of NEWEST.')
    .option('-o, --output <outputPath>', 'specify where to place the output. Default: Merged')
    .option('-lo, --log-output <outputPath>', 'specify where to place the log output for the merge. Default: mergelog.txt')
    .argument('<base path>', 'the file path to the base file (the oldest file)')
    .argument('<newest path>', 'the file path to take edits from (the newest file)')
    .action(async (basePath, newestPath, options) => {
        await mergeTool(basePath, newestPath, options);
    });

(async () => {
    await program.parseAsync(process.argv);
})();
