'use strict';

const common = require('./common.js');
const db = require('./db.js');
const mysql = require('mysql');
const osrm = require('./osrm.js');
const request = require('request');

const TARGET_DIRECTORY = common.serverConfig.resultsFolder;

/**
 * efface les affectation d'adresses aux tournees
 * puis appelles insertTours qui va rajouter les tournees manquantes
 *
 * puis enfin pour chaque adresse de chaque tournee enregistre dans la bdd
 * a quelle tournee l'adresse est affectee et a quelle position elle est
 *
 * @params {Array} tours un tableau d'objets {
 *                                        trip: trip,
 *                                        addresses: featColl
 *                                     }
 *
 */
function fillDb(tours) {

  db.clearTourAssignments()
    .then(db.insertTours(tours.length))
    .then(() => {

      for (let i in tours) {

        let tour = tours[i];

        // common.writeFile(TARGET_DIRECTORY + '/tourTrip' + i + '.json', JSON.stringify(
        //   tour.trip.trips[0], null, 2));

        let dbCon = mysql.createConnection(common.serverConfig.db);

        let promises = [];

        for (let j in tour.addresses.features) {

          let feat = tour.addresses.features[j];

          let w_index = tour.trip.waypoints[j].waypoint_index

          feat.properties.waypoint_index = w_index;

          if (j > 0)
            promises.push(db.assignAddressToTour(feat.id, i, w_index, dbCon));

        }

        Promise.all(promises)
          .then(() => { dbCon.end(); });

        // common.writeFile(TARGET_DIRECTORY + '/tourAddresses' + i + '.json', JSON.stringify(
        //   tour.addresses, null, 2));

      }

    });
}
exports.fillDb = fillDb;

/**
 * A partir des adresses de la tournee demandee, obtenues avec db.getTour
 * Construit la route avec osrm
 *
 * @param {Integer} tourNum le numero de la tournee demandee base sur 0
 * @deliveryDate {Date} la date de livraison
 *
 */
function getRoute(tourNum, deliveryDate) {

  return new Promise((resolve, reject) => {

    const TOUR_FILE = TARGET_DIRECTORY + '/tourTrip' + tourNum + '.json';
    const ADDRESSES_FILE = TARGET_DIRECTORY + '/tourAddresses' + tourNum + '.json';

    db.getTour(tourNum, deliveryDate)
      .then((addressesColl) => {

        for (let i in addressesColl.features) {

          addressesColl.features[i].setWaypointIndex(i);

        }

        addressesColl.features.push(addressesColl.features[0]);

        let oReq = new osrm.OsrmRequest('route', true);

        oReq.setFromAddresses(addressesColl);

        let madeUrl = oReq.makeUrl();

        request(madeUrl, (error, response, body) => {

          if (error) {
            console.log('error:', error); // Print the error if one occurred
            console.log('statusCode:', response.statusCode); // Print the response status code if a response was received
          } else {

            // console.log('response from ' + service + ' service');
            // console.log(body);
            let parsedBody = JSON.parse(body);

            let route = parsedBody.routes[0];

            common.writeFile(TOUR_FILE, JSON.stringify(route,
              null, 1));

            resolve([TOUR_FILE, ADDRESSES_FILE]);

          }
        });

        common.writeFile(ADDRESSES_FILE, JSON.stringify(
          addressesColl, null, 1));

      });

  });

}

/**
 * A partir des adresses de la bdd et de la date de livraison donnee
 * Construit la route de la tourn ee exterieure a albi avec osrm
 *
 * @deliveryDate {Date} la date de livraison
 *
 */
function getOutsideTour(deliveryDate) {

  return new Promise((resolve, reject) => {

    const TOUR_FILE = TARGET_DIRECTORY + '/tourTripOutside.json';
    const ADDRESSES_FILE = TARGET_DIRECTORY + '/tourAddressesOutside.json';

    db.getOutsideAddresses(deliveryDate)
      .then((addressesColl) => {

        let oReq = new osrm.OsrmRequest('trip', true);

        oReq.setFromAddresses(addressesColl);

        let madeUrl = oReq.makeUrl();

        request(madeUrl, (error, response, body) => {

          if (error) {
            console.log('error:', error); // Print the error if one occurred
            console.log('statusCode:', response.statusCode); // Print the response status code if a response was received
          } else {

            // console.log('response from ' + service + ' service');
            // console.log(body);
            let parsedBody = JSON.parse(body);
            // console.log(parsedBody);

            for (let i in addressesColl.features) {

              addressesColl.features[i].setWaypointIndex(parsedBody.waypoints[i].waypoint_index);
              addressesColl.features[i].properties.tour.num = 'Extérieure';

            }

            common.writeFile(ADDRESSES_FILE, JSON.stringify(
              addressesColl, null, 1));

            let route = parsedBody.trips[0];

            common.writeFile(TOUR_FILE, JSON.stringify(route,
              null, 1));

            resolve([TOUR_FILE, ADDRESSES_FILE]);

          }
        });

      });

  });

}

function getTourByQueryNum(num, deliveryDate) {

  if (num == 'Outside') {
    return getOutsideTour(deliveryDate);
  } else
    return getRoute(num, deliveryDate);

}
exports.getTourByQueryNum = getTourByQueryNum;

// getRoute(0, '2017-04-24')
//   .then((files) => {

//     console.log(files);

//   });
