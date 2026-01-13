const fs = require('fs');
const path = require('path');

const servicesDir = path.join(__dirname, 'src', 'services');

const files = fs.readdirSync(servicesDir).filter(f => f.endsWith('.ts'));

files.forEach(file => {
  const filePath = path.join(servicesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix the PrismaClient constructor with proper indentation
  content = content.replace(
    /new PrismaClient\(\)/g,
    'new PrismaClient({\n      datasources: {\n        db: {\n          url: process.env.DATABASE_URL || "file:./dev.db"\n        }\n      }\n    })'
  );
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed: ${file}`);
});

console.log('Done fixing PrismaClient configurations.');