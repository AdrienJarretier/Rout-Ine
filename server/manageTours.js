'use strict';

const common = require('./common.js');
const db = require('./db.js');
const mysql = require('mysql');

const TARGET_DIRECTORY = common.serverConfig.resultsFolder;

function fillDb(tours) {

  db.clearTourAssignments()
    .then(db.insertTours(tours.length))
    .then(() => {

      for (let i in tours) {

        let tour = tours[i];

        common.writeFile(TARGET_DIRECTORY + '/tourTrip' + i + '.json', JSON.stringify(
          tour.trip.trips[0], null, 2));

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

        common.writeFile(TARGET_DIRECTORY + '/tourAddresses' + i + '.json', JSON.stringify(
          tour.addresses, null, 2));

      }

    });
}

exports.fillDb = fillDb;


// function getTour(tourNum, deliveryDate) {

//   return new Promise((resolve, reject) => {



//   });

// }


// function get(tourNum) {

//   return new Promise((resolve, reject) => {

//     db.extractNamesList(tourFile)
//       .then(db.getFullAddressesData)
//       .then((featCollection) => {

//         let testTrips = {
//           original: {},
//           osrmTrip: {},
//           filled: 0,
//           addresses: featCollection
//         };

//         function requestToOsrm(service) {
//           let oReq = new osrm.OsrmRequest(service, true);

//           oReq.setFromAddresses(featCollection);

//           let madeUrl = oReq.makeUrl();

//           request(madeUrl, (error, response, body) => {

//             if (error) {
//               console.log('error:', error); // Print the error if one occurred
//               console.log('statusCode:', response.statusCode); // Print the response status code if a response was received
//             } else {

//               // console.log('response from ' + service + ' service');
//               let parsedBody = JSON.parse(body);

//               // l'objet route retourne par osrm, nom different selon le service
//               let route = {};

//               if (service == 'route') {
//                 testTrips.original = parsedBody;
//                 route = parsedBody.routes[0];

//               } else if (service == 'trip') {

//                 testTrips.osrmTrip = parsedBody;
//                 route = parsedBody.trips[0];
//               }

//               if (++testTrips.filled == 2) {

//                 resolve(testTrips);
//               }

//               console.log('');
//               console.log('** ' + service + ' service **');
//               console.log('distance : ' + Math.ceil(route.distance / 10) / 100 +
//                 ' km');

//               let h = Math.floor(route.duration / 3600);
//               let m = Math.ceil((route.duration % 3600) / 60);
//               console.log('duration : ' + h + 'h ' + m);


//               m += 3 * featCollection.features.length;
//               h += Math.floor(m / 60);
//               m %= 60;
//               console.log('duration (3 min / address) : ' + h + 'h ' + m);

//             }
//           });
//         }

//         requestToOsrm('route');
//         requestToOsrm('trip');

//       })
//       .catch((reason) => {
//         reject('rejected ' + tourFile + ' : ' + reason);
//       });

//   });
// }
