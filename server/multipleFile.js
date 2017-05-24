'use strict';

const common = require('./common.js');

const TARGET_DIRECTORY = common.serverConfig.resultsFolder;

common.readFile('gaResults/bestTours.json')
  .then((content) => {

    let object = JSON.parse(content);

    console.log(object);

    for (let i in object.trips) {

      let tour = object.trips[i];

      common.writeFile(TARGET_DIRECTORY + '/tourTrip' + i + '.js', 'let jsonFeatureTrip = ' + JSON.stringify(
        tour.trip.trips[0], null, 2) + ';');

      // common.writeJson(TARGET_DIRECTORY+'/tourTrip' + i + '.json', tour.trip.trips[0]);

      for (let j in tour.addresses.features) {

        tour.addresses.features[j].properties.waypoint_index = tour.trip.waypoints[j].waypoint_index;

      }

      // for (let j in tour.trip.trips[0]) {

      //   trips[i].addresses.features[j].setWaypointIndex(trips[i].osrmTrip.waypoints[j].waypoint_index);

      // }


      common.writeFile(TARGET_DIRECTORY + '/tourAddresses' + i + '.js', 'let geojsonFeature = ' + JSON.stringify(
        tour.addresses, null, 2) + ';');
      // common.writeJson('tourAddresses' + i + '.json', tour.addresses);

    }

  });
