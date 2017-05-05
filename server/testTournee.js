'use strict';

const AddressFeature = require('./AddressFeature.js');
const db = require('./db.js');
const FeatureCollection = require('./FeatureCollection.js');
const fs = require('fs');
const mysql = require('mysql');
const osrm = require('./osrm.js');
const request = require('request');
const togpx = require('togpx');
const tokml = require('tokml');


const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// getAll()
//   .then((dfqsf) => { console.log('ok'); })
//   .catch((df) => { console.log('error when getting all tours : ' + df); });

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

        })
        .catch((reason) => {
          reject(reason);
        });
    }

  });

}

function saveTourToGpx(tourFile, targetFile) {

  get(tourFile)
    .then((data) => {

      let geoJson = data.osrmTrip.trips[0].geometry;

      fs.writeFile(targetFile, togpx(geoJson), (err) => {
        if (err) throw err;
      });

    });

}

saveTourToKML('tournee_prest2.csv', 'testTour');

function saveTourToKML(tourFile, targetFile) {

  get(tourFile)
    .then((data) => {

      let geoJson = data.osrmTrip.trips[0].geometry;

      fs.writeFile(targetFile + 'Trip.kml', tokml(geoJson), (err) => {
        if (err) throw err;
      });

      fs.writeFile(targetFile + 'Points.kml', tokml(data.addresses), (err) => {
        if (err) throw err;
      });

    });

}

function get(tourFile) {

  return new Promise((resolve, reject) => {

    db.extractNamesList(tourFile)
      .then(db.getFullAddressesData)
      .then((featCollection) => {

        let testTrips = {
          original: {},
          osrmTrip: {},
          filled: 0,
          addresses: featCollection
        };

        function requestToOsrm(service) {
          let oReq = new osrm.OsrmRequest(service, true);

          oReq.setFromAddresses(featCollection);

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


              m += 3 * featCollection.features.length;
              h += Math.floor(m / 60);
              m %= 60;
              console.log('duration (3 min / address) : ' + h + 'h ' + m);

            }
          });
        }

        requestToOsrm('route');
        requestToOsrm('trip');

      })
      .catch((reason) => {
        reject('rejected ' + tourFile + ' : ' + reason);
      });

  });
}

exports.getAll = getAll;
