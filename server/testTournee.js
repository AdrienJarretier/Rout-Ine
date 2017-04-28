const csvParse = require('csv-parse/lib/sync');
const fs = require('fs');
const mysql = require('mysql');
const osrm = require('./osrm.js');


const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

const csvFile = fs.openSync('tournee_prest2.csv', 'r');

const csvContent = fs.readFileSync(csvFile);

fs.closeSync(csvFile);

var dataArray = csvParse(csvContent, { delimiter: "," });

const sql = ' SELECT distinct a.id, a.label, a.town, a.additional, a.lat, a.lng, beneficiary.*  \n' +
  ' FROM address a \n' +
  ' RIGHT JOIN beneficiary ON a.id=beneficiary.address_id \n' +
  ' WHERE a.id IS NOT NULL \n' +
  ' AND beneficiary.name like ?;';

let dbCon = mysql.createConnection(config.db);

let queriesDone = 0;
let notFound = 0;

let addresses = [];

for (let i in dataArray) {

  let line = dataArray[i];
  let name = line[0];

  const select = mysql.format(sql, [name]);

  dbCon.query(
    select,
    (err, rows, fields) => {

      if (++queriesDone == dataArray.length) {
        dbCon.end();

        if (notFound == 0) {
          console.log(addresses);

          let oReq = new osrm.OsrmRequest('route', false);

          for (let adr of addresses)
            oReq.addCoords(adr.lat, adr.lng);

          let madeUrl = oReq.makeUrl();
          console.log(madeUrl);

        }
      }

      if (err) throw err

      if (rows.length == 0) {
        console.log('name not found : ' + name);
        ++notFound;
      } else
        addresses[i] = rows[0];

    });

}
