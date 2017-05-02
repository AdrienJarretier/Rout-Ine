const csvParse = require('csv-parse/lib/sync');
const fs = require('fs');
const mysql = require('mysql');
const osrm = require('./osrm.js');
const request = require('request');


const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

get();

function get() {

  return new Promise((resolve, reject) => {

    const csvFile = fs.openSync('tournee_prest2.csv', 'r');

    const csvContent = fs.readFileSync(csvFile);

    fs.closeSync(csvFile);

    var dataArray = csvParse(csvContent, { delimiter: "," });

    // let namesPlaceholder = '';
    // let names = [];

    // for (let line of dataArray) {
    //   namesPlaceholder += '?,';
    //   names.push(line[0]);
    // }

    // namesPlaceholder = namesPlaceholder.slice(0, -1);

    // const sql = ' SELECT distinct a.id, a.label, a.town, a.lat, a.lng \n' +
    //   ' FROM address a \n' +
    //   ' RIGHT JOIN beneficiary ON a.id=beneficiary.address_id \n' +
    //   ' WHERE a.id IS NOT NULL \n' +
    //   ' AND beneficiary.name in (' + namesPlaceholder + ');';

    // const select = mysql.format(sql, names);


    const sql = ' SELECT distinct a.id, a.label, a.town, a.lat, a.lng, beneficiary.*  \n' +
      ' FROM address a \n' +
      ' RIGHT JOIN beneficiary ON a.id=beneficiary.address_id \n' +
      ' WHERE a.id IS NOT NULL \n' +
      ' AND beneficiary.name like ?;';

    let dbCon = mysql.createConnection(config.db);

    let queriesDone = 0;
    let notFound = 0;

    let addresses = [];

    console.log(dataArray.length + ' beneficiaries');

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
              // console.log(addresses);

              let testTrips = {
                original: {},
                osrmTrip: {},
                filled: 0
              };

              function requestToOsrm(service) {
                let oReq = new osrm.OsrmRequest(service, true);


                for (let adr of addresses)
                  oReq.addCoords(adr.lat, adr.lng);

                let madeUrl = oReq.makeUrl();


                request(madeUrl, (error, response, body) => {

                  if (error) {
                    console.log('error:', error); // Print the error if one occurred
                    console.log('statusCode:', response.statusCode); // Print the response status code if a response was received
                  } else {

                    // console.log('response from ' + service + ' service');
                    let parsedBody = JSON.parse(body);

                    // l'objet route retourne par osrm, nom different selon le service
                    let route = {};

                    if (service == 'route') {
                      testTrips.original = parsedBody;
                      route = parsedBody.routes[0];

                    } else if (service == 'trip') {

                      testTrips.osrmTrip = parsedBody;
                      route = parsedBody.trips[0];
                    }

                    if (++testTrips.filled == 2)
                      resolve(testTrips);

                    console.log('** Route service **');
                    console.log('distance : ' + Math.ceil(route.distance / 10) / 100 +
                      ' km');

                    let h = Math.floor(route.duration / 3600);
                    let m = Math.ceil((route.duration % 3600) / 60);
                    console.log('duration : ' + h + 'h ' + m);


                    m += 3 * dataArray.length;
                    h += Math.floor(m / 60);
                    m %= 60;
                    console.log('duration (3 min / benef) : ' + h + 'h ' + m);

                  }
                });
              }

              requestToOsrm('route');
              requestToOsrm('trip');


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



  });
}

exports.get = get;
