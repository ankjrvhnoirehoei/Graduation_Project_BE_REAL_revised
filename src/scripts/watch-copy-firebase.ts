import { watch, existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';

const srcPath = join(__dirname, '../src/config/firebase-adminsdk.json');
const destPath = join(__dirname, '../dist/config/firebase-adminsdk.json');
const destDir = dirname(destPath);

const copy = () => {
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
  copyFileSync(srcPath, destPath);
  console.log('✅ Copied firebase-adminsdk.json');
};

copy();

watch(srcPath, (event) => {
  if (event === 'change' || event === 'rename') {
    copy();
  }
});