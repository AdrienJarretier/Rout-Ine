const fs = require('fs');
const mysql = require('mysql');
const parse = require('csv-parse/lib/sync');


const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

const csvFile = fs.openSync('tournee_prest2.csv', 'r');

const csvContent = fs.readFileSync(csvFile);

fs.closeSync(csvFile);

var dataArray = parse(csvContent, { delimiter: "," });

const sql = ' SELECT distinct a.id, a.label, a.town, a.additional, a.lat, a.lng, beneficiary.*  \n' +
  ' FROM address a \n' +
  ' RIGHT JOIN beneficiary ON a.id=beneficiary.address_id \n' +
  ' WHERE a.id IS NOT NULL \n' +
  ' AND beneficiary.name = ?;';

let dbCon = mysql.createConnection(config.db);

let queriesDone = 0;

for (let line of dataArray) {

  let name = line[0];

  const select = mysql.format(sql, [name]);

  dbCon.query(
    select,
    (err, rows, fields) => {

      if (err) throw err

      if (++queriesDone == dataArray.length)
        dbCon.end();

      console.log(select);

      console.log(rows);

      console.log();

    });

}
