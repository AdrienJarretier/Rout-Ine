'use strict';

const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const request = require('request');
const db = require('./db.js');
const shuffle = require('shuffle-array');
const utils = require('./utils.js');

class OsrmRequest {
  constructor(service) {
    // One of the following values: route, nearest, table, match, trip, tile
    this.service = service;

    // Version of the protocol implemented by the service. v1 for all OSRM 5.x installations
    this.version = "v1";

    // Mode of transportation, is determined statically by the Lua profile that is used to prepare the data using osrm-extract. Typically car, bike or foot if using one of the supplied profiles.
    this.profile = "car";


    // an array of coordinates that are arrays of 2 elements : [latitude, longitude]
    this.coords = [];

    /*
        steps : Return route steps for each route leg

        geometries : Returned route geometry format (influences overview and per step)

        roundtrip : Return route is a roundtrip
        source : Return route starts at `any` or `first` coordinate
        destination : Return route ends at `any` or `last` coordinate
        if source=any&destination=any the returned round-trip will still start at the first input coordinate by default.

        overview : Add overview geometry either `full`, `simplified` according to highest zoom level it could be display on, or not at all (`false`).
    */

    switch (service) {

      case 'trip':
        this.options = {
          steps: false,
          geometries: "geojson", // Returned route geometry in Geojson for Leaflet
          overview: "full" // full overview geometry
        };
        break;

      default:
        this.options = {};
        break;

    }
  }

  /**
   * Make the request Url for osrm-routed (HTTP server)
   *
   * @returns {string} the url for the request ready to be sent.
   */
  makeUrl() {
    let requestUrl = config.osrm.protocol + '://' + config.osrm.ip + ':' + config.osrm.port + '/' +
      this.service + '/' + this.version + '/' + this.profile + '/';

    for (let i = 0; i < this.coords.length; ++i) {

      requestUrl += this.coords[i][1] + ',' + this.coords[i][0] + ';';
    }

    // removing the last ';'
    requestUrl = requestUrl.slice(0, -1);

    // get the array of options keys
    let optionsKeys = Object.keys(this.options);

    if (optionsKeys.length > 0) {
      requestUrl += '?';

      for (let i = 0; i < optionsKeys.length; ++i) {

        let key = optionsKeys[i];
        requestUrl += key + '=' + this.options[key] + '&';
      }

      // removing the last '&'
      requestUrl = requestUrl.slice(0, -1);
    }

    return requestUrl;
  }

  addCoords(lat, lng) {

    // doit rajouter un tableau de la forme [latitute, longitude] dans coords

    this.coords.push([lat, lng]);
  }

  setCoords(coords) {

    for (let c of coords) {
      this.addCoords(c.lat, c.lng);
    }

  }

  setFromAddresses(addresses) {

    for (let c of addresses.features) {
      this.addCoords(c.coordinates[1], c.coordinates[0]);
    }

  }

}


/**
 *
 *
 * returns a Promise which is fulfilled with the trip when the OSRM server answers
 */
function getTripFromAddresses(addresses) {

  return new Promise((resolve, reject) => {

    let oReq = new OsrmRequest('trip');

    oReq.setFromAddresses(addresses);

    request(oReq.makeUrl(), (error, response, body) => {

      if (error) {
        console.log('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
      } else {

        let response = JSON.parse(body);

        resolve(response);

      }
    });

  });

}


function getTableFromAddresses(addresses) {

  return new Promise((resolve, reject) => {

    let oReq = new OsrmRequest('table');

    oReq.setFromAddresses(addresses);

    let url = oReq.makeUrl();

    console.log('url length : ' + url.length);

    request(url, (error, response, body) => {

      if (error) {
        console.log('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
      } else {

        console.log('body length : ' + body.length);

        let response = JSON.parse(body);

        let durations = [
          []
        ];

        for (let i = 0; i < response.durations.length; ++i) {
          let uniDurations = [];
          for (let j = 0; j < response.durations[i].length; ++j) {

            if (i != j)
              uniDurations.push({
                dur: response.durations[i][j],
                source_id: addresses.features[i].id,
                destination_id: addresses.features[j].id,
                dest_feature: addresses.features[j]
              });
          }

          uniDurations.sort((a, b) => {
            return a.dur - b.dur
          });

          durations.push(uniDurations);
        }

        resolve(durations);

      }
    });

  });

}

class ResultTrip {
  constructor() {
    this.addresses = { // resultat de db.getAddresses (mais avec seulement une partie des adresses)
      type: 'FeatureCollection',
      features: []
    };

    this.route = {}; // resultat du service trip de OSRM, element du tableau Trips : cad un objet Route
  }

  setAddressFeatures(addressFeatures) {
    this.addresses.features = addressFeatures;
  }

  setTrip(trip) {
    this.route = trip;
  }

  getAddressFeature(i) {
    return this.features[i];
  }
}

function removeDestination(durations, dest_id) {

  for (let i = 1; i < durations.length; ++i) {

    for (let j = 0; j < durations[i].length; ++j) {

      // console.log(durations[i][j]);

      if (durations[i][j].destination_id == dest_id) {
        durations[i].splice(j, 1);
        break;
      }
    }
  }
}

function greedyChunk(addressesGeoJson, nbTrips) {

  return new Promise((resolve, reject) => {
    getTableFromAddresses(addressesGeoJson)
      .then((dur) => {

        // console.log(addressesGeoJson);

        let trips = [];

        for (let i = 0; i < nbTrips; ++i) {
          trips.push([addressesGeoJson.features[0]]);

        }
        removeDestination(dur, addressesGeoJson.features[0].id);

        // console.log('ok 1 ');

        while (dur[1].length > 0) {

          for (let i = 0; i < nbTrips && dur[1].length > 0; ++i) {

            // console.log('ok 2 ');

            let lastDest = trips[i][trips[i].length - 1];
            // on recupere la destination en fin de liste,
            // qui devient la source pour al prochaine

            // console.log(lastDest);

            console.log(lastDest.id);

            // la prochaine destination est la plus proche de notre source
            let nextDest = dur[lastDest.id][0];

            // console.log('ok 3 ');
            trips[i].push(nextDest.dest_feature);

            removeDestination(dur, nextDest.destination_id);
          }
        }

        resolve(trips);

      });

  });

}

// db.getFullAddressesData()
//   .then((addressesGeoJson) => {
//     mjkljkvv(addressesGeoJson, 6);

//   });

function getHalfTrip(nbTrips) {

  return new Promise((resolve, reject) => {

    let resultTrips = []; // tableau d'instances de ResultTrip

    db.getFullAddressesData()
      .then((addressesGeoJson) => {
        // addressesGeoJson est une FeatureCollection
        // où chaque Feature est un objet AddressFeature

        // shuffle(addressesGeoJson.features);

        // let addressesChunks = utils.chunkify(addressesGeoJson.features, nbTrips);

        greedyChunk(addressesGeoJson, nbTrips)
          .then((addressesChunks) => {
            // console.log(addressesChunks);

            for (let chunk of addressesChunks) {

              let result = new ResultTrip();

              result.setAddressFeatures(chunk);

              getTripFromAddresses(result.addresses)
                .then((trip) => {

                  for (let i = 0; i < trip.waypoints.length; ++i) {

                    let w_ind = trip.waypoints[i].waypoint_index;
                    result.addresses.features[i].setWaypointIndex(w_ind);
                  }

                  result.setTrip(trip.trips[0]);
                  resultTrips.push(result);

                  if (resultTrips.length == nbTrips)
                    resolve(resultTrips);
                });

            }

          });


      });

  });
}

exports.getTrips = getHalfTrip;
