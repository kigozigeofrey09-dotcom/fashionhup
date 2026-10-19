import fs from 'fs';
fs.cpSync('dist', 'android/app/src/main/assets/public', { recursive: true });
console.log('Assets copied to Android project successfully!');
