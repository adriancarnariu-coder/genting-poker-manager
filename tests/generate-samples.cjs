const XLSX=require('../public/vendor/xlsx.full.min.cjs');
const path=require('node:path');
const headers=['Player ID','Player Name','Chip Count','Flight','Nationality','Nationality Verified','Publication Permission'];
const samples={
  'qualified-1a.xlsx':[
    ['S001','Alex Morgan',386000,'1A','GB','yes','yes'],
    ['S002','Sam Taylor',274500,'1A','IE','',''],
    ['S003','Jordan Lee',192000,'1A','','','no'],
    ['S004','Casey Ellis',148000,'1A','GB','yes','yes'],
    ['S005','Robin Chen',95500,'1A','','','yes']
  ],
  'qualified-1b.xlsx':[
    ['S006','Jamie Parker',425000,'1B','GB','yes','yes'],
    ['S002','Samuel Taylor',287000,'1B','IE','','yes'],
    ['S007','',175000,'1B','','',''],
    ['S008','Drew James','unknown','1B','','',''],
    ['S009','Morgan Blake',112000,'1B','','','no']
  ],
  'entries-1a.xls':[
    ['S001','Alex Morgan','','1A','GB','yes','yes'],
    ['S002','Sam Taylor','','1A','IE','',''],
    ['S010','Avery Stone',999999,'1A','','','yes']
  ],
  'reentries-1a.xlsx':[['S010','Avery Stone',888888,'1A','','','yes']]
};
for(const [name,rows] of Object.entries(samples)){
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([headers,...rows]),'Report');
  require('node:fs').writeFileSync(path.join(__dirname,'../public/samples',name),XLSX.write(wb,{type:'buffer',bookType:name.endsWith('.xls')?'biff8':'xlsx'}));
}
console.log('Generated four synthetic Excel workbooks.');
