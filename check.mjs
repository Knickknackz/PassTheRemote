import path from 'path';
import fs from 'fs';

const file = path.resolve('./src/crunchyrollParentPage.js');
console.log('Exists:', fs.existsSync(file));
console.log('Resolved path:', file);