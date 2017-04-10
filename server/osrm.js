'use strict';

const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const request = require('request');

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

}

/**
 *
 *
 * returns a Promise which is fulfilled with the trip array when the OSRM server answers
 */
function getTrip() {

  let oReq = new OsrmRequest();

  oReq.addCoords(43,2);
  oReq.addCoords(43.1,2.1);
  oReq.addCoords(43.2,2.2);

  console.log(oReq);

  let madeUrl = oReq.makeUrl();

  console.log(madeUrl);

  return new Promise((resolve, reject) => {

    request(madeUrl, (error, response, body) => {

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

exports.getTrip = getTrip;
