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
