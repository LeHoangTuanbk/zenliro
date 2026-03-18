#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const fileName = fileURLToPath(import.meta.url);
const dirName = path.dirname(fileName);

const shadcnDir = path.join(dirName, '../src/ui/shared/ui/base');
const indexPath = path.join(shadcnDir, 'index.ts');

// Get all .tsx files directly in base/ (not in subdirectories)
const componentFiles = fs
  .readdirSync(shadcnDir)
  .filter(file => {
    const filePath = path.join(shadcnDir, file);
    return file.endsWith('.tsx') && fs.statSync(filePath).isFile();
  })
  .map(file => path.basename(file, '.tsx'))
  .sort();

if (componentFiles.length === 0) {
  console.log(
    '✓ No new components to export. All components are already exported.',
  );
  process.exit(0);
}

// Organize each component into its own folder
for (const componentName of componentFiles) {
  const componentDir = path.join(shadcnDir, componentName);
  const sourceFile = path.join(shadcnDir, `${componentName}.tsx`);
  const targetFile = path.join(componentDir, `${componentName}.tsx`);
  const componentIndexFile = path.join(componentDir, 'index.ts');

  // Create component directory
  if (!fs.existsSync(componentDir)) {
    fs.mkdirSync(componentDir, { recursive: true });
  }

  // Move component file
  fs.renameSync(sourceFile, targetFile);

  // Create component index.ts
  fs.writeFileSync(componentIndexFile, `export * from './${componentName}';\n`);
}

// Update base/index.ts to export from folders
const allComponentDirs = fs
  .readdirSync(shadcnDir)
  .filter(item => {
    const itemPath = path.join(shadcnDir, item);
    return fs.statSync(itemPath).isDirectory();
  })
  .sort();

const exportStatements = allComponentDirs
  .map(dir => `export * from './${dir}';`)
  .join('\n');

fs.writeFileSync(indexPath, `${exportStatements}\n`);

console.log(
  `✓ Added ${componentFiles.length} new export(s): ${componentFiles.join(', ')}`,
);
