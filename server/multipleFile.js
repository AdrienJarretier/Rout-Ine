'use strict';

const common = require('./common.js');

const TARGET_DIRECTORY = common.serverConfig.resultsFolder;

function fillDb(tours) {

  for (let i in tours) {

    let tour = tours[i];

    common.writeFile(TARGET_DIRECTORY + '/tourTrip' + i + '.json', JSON.stringify(
      tour.trip.trips[0], null, 2));

    for (let j in tour.addresses.features) {

      tour.addresses.features[j].properties.waypoint_index = tour.trip.waypoints[j].waypoint_index;

    }

    common.writeFile(TARGET_DIRECTORY + '/tourAddresses' + i + '.json', JSON.stringify(
      tour.addresses, null, 2));

  }

}

exports.fillDb = fillDb;
