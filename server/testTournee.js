'use strict';

const AddressFeature = require('./AddressFeature.js');
const csvParse = require('csv-parse');
const db = require('./db.js');
const FeatureCollection = require('./FeatureCollection.js');
const fs = require('fs');
const mysql = require('mysql');
const osrm = require('./osrm.js');
const request = require('request');


const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

function getAll() {

  return new Promise((resolve, reject) => {

    const files = [
      'tournee_prest2.csv',
      'tournee_prest_T2.csv'
    ];

    let tripsDone = 0;

    let tours = [];

    for (let i in files) {

      let filename = files[i];

      get(filename)
        .then((testTrips) => {

          tours[i] = testTrips;

          if (++tripsDone == files.length) {
            resolve(tours);
          }

        });
    }

  });

}

extractNamesList('tour1and2.csv')
  .then((names) => {

    console.log(names);

  });

function extractNamesList(csvFile) {

  return new Promise((resolve, reject) => {

    fs.open(csvFile, 'r', (err, fd) => {
      fs.readFile(fd, (err, data) => {

        fs.close(fd);

        csvParse(data, { delimiter: "," }, function(err, output) {
          let names = [];

          for (let line of output)
            names.push(line[0]);

          resolve(names);
        });

      });
    });
  });
}

function get(tourFile) {

  return new Promise((resolve, reject) => {

    const csvFile = fs.openSync(tourFile, 'r');

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


    const sql =
      ' SELECT distinct a.id, a.label, a.town, a.lat, a.lng, beneficiary.id as beneficiary_id, name, birthdate, address_additional  \n' +
      ' FROM address a \n' +
      ' RIGHT JOIN beneficiary ON a.id=beneficiary.address_id \n' +
      ' WHERE a.id IS NOT NULL \n' +
      ' AND beneficiary.name like ?;';

    let dbCon = mysql.createConnection(config.db);

    let queriesDone = 0;
    let notFound = 0;

    let addresses = [];

    console.log(dataArray.length + ' beneficiaries');

    // la variable i est simplement utilisee pour garantir le maintient de lo'rdre initial des adresses
    // on utilise alors une variable 'offset' pour eviter les cases vides quand l'adresses est deja dans notre tableau
    let addressesOffset = 0;
    for (let i in dataArray) {

      let line = dataArray[i];
      let name = line[0];

      const select = mysql.format(sql, [name]);

      dbCon.query(
        select,
        (err, rows, fields) => {

          // console.log(rows);

          if (err) throw err

          if (rows.length == 0) {
            console.log('name not found : ' + name);
            ++notFound;
          } else if (notFound == 0) {

            let notInArray = true;

            // console.log('rows[0]');
            // console.log(rows[0]);

            for (let ad of addresses) {
              // console.log('ad');
              // console.log(addresses);

              if (ad.id == rows[0].id) {

                ad.addBeneficiary({
                  name: rows[0].name,
                  birthdate: rows[0].birthdate,
                  address_additional: rows[0].address_additional
                });

                notInArray = false;
                ++addressesOffset;
                break;
              }
            }

            if (notInArray) {
              addresses[i - addressesOffset] = new AddressFeature(rows[0]);

              addresses[i - addressesOffset].addBeneficiary({
                name: rows[0].name,
                birthdate: rows[0].birthdate,
                address_additional: rows[0].address_additional
              });
            }
          }

          if (++queriesDone == dataArray.length) {
            dbCon.end();

            db.ccasAddress()
              .then((ccasAddress) => {

                addresses.unshift(new AddressFeature(ccasAddress));

                console.log('');
                console.log(addresses.length + ' addresses');
                // console.log(addresses);

                addresses = new FeatureCollection(addresses);

                // for(let adF of addresses.features)
                //   console.log(adF.properties);

                if (notFound == 0) {

                  let testTrips = {
                    original: {},
                    osrmTrip: {},
                    filled: 0,
                    addresses: addresses
                  };

                  function requestToOsrm(service) {
                    let oReq = new osrm.OsrmRequest(service, true);

                    oReq.setFromAddresses(addresses);

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

                        if (++testTrips.filled == 2) {

                          resolve(testTrips);
                        }

                        console.log('');
                        console.log('** ' + service + ' service **');
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


              });
          }

        });

    }



  });
}

exports.getAll = getAll;
