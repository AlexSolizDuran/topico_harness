const fs = require('fs');
console.log(fs.readFileSync('src/interface/app.tsx','utf8').includes('PanelContexto')); 
