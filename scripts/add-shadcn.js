#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const components = process.argv.slice(2);

if (components.length === 0) {
  console.error('Usage: pnpm run shadcn:add <component> [component2] [component3]...');
  console.error('Example: pnpm run shadcn:add button input card');
  process.exit(1);
}

try {
  console.log(`Adding components: ${components.join(', ')}...`);
  execSync(`pnpm dlx shadcn@latest add ${components.join(' ')}`, {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  // Generate exports
  execSync('node scripts/generate-shadcn-exports.js', {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  for (const component of components) {
    execSync(`prettier --write "src/ui/shared/ui/base/${component}/**/*.{ts,tsx}"`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  }

  console.log('\n✓ Done!');
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
