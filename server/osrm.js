'use strict';

const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const request = require('request');
const db = require('./db.js');
const shuffle = require('shuffle-array');
const utils = require('./utils.js');

class OsrmRequest {
  constructor() {
    // One of the following values: route, nearest, table, match, trip, tile
    this.service = "trip";

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
    this.options = {
      steps: false,
      geometries: "geojson", // Returned route geometry in Geojson for Leaflet
      overview: "full" // full overview geometry
    };
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
 * returns a Promise which is fulfilled with the array of trip arrays when the OSRM server answers
 */
function getTripFromAddresses(addresses) {

  return new Promise((resolve, reject) => {

    let oReq = new OsrmRequest();

    oReq.setFromAddresses(addresses);

    request(oReq.makeUrl(), (error, response, body) => {

      if (error) {
        console.log('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
      } else {

        let response = JSON.parse(body);

        resolve(response.trips[0]);

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
}

function getHalfTrip(nbTrips) {

  return new Promise((resolve, reject) => {

    let resultTrips = []; // tableau d'instances de ResultTrip

    db.getFullAddressesData()
      .then((addressesGeoJson) => {

        shuffle(addressesGeoJson.features);

        let addressesChunks = utils.chunkify(addressesGeoJson.features, nbTrips);

        for (let chunk of addressesChunks) {

          let result = new ResultTrip();

          result.setAddressFeatures(chunk);

          getTripFromAddresses(result.addresses)
            .then((trip) => {

              result.setTrip(trip);
              resultTrips.push(result);

              if (resultTrips.length == nbTrips)
                resolve(resultTrips);
            });

        }

      });

  });
}

exports.getTrips = getHalfTrip;
