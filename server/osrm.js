'use strict';

const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const request = require('request');

/**
 * Make the request Url for osrm-routed (HTTP server)
 *
 * @param {object} osrmReq - the object with the parameters of the request, see the osrmReq object created below
 *
 * @returns {string} the url for the request ready to be sent.
 */
function makeUrl(osrmReq) {

  let requestUrl = config.osrm.protocol + '://' + config.osrm.ip + ':' + config.osrm.port + '/' +
    osrmReq.service + '/' + osrmReq.version + '/' + osrmReq.profile + '/';

  for (let i = 0; i < osrmReq.coords.length; ++i) {

    // requestUrl += osrmReq.coords[i].lo + ',' + osrmReq.coords[i].la + ';';
    requestUrl += osrmReq.coords[i][1] + ',' + osrmReq.coords[i][0] + ';';
  }

  // removing the last ';'
  requestUrl = requestUrl.slice(0, -1);

  // get the array of options keys
  let optionsKeys = Object.keys(osrmReq.options);

  if (optionsKeys.length > 0) {
    requestUrl += '?';

    for (let i = 0; i < optionsKeys.length; ++i) {

      let key = optionsKeys[i];
      requestUrl += key + '=' + osrmReq.options[key] + '&';
    }

    // removing the last '&'
    requestUrl = requestUrl.slice(0, -1);
  }

  return requestUrl;
}


let osrmReq = {

  // One of the following values: route, nearest, table, match, trip, tile
  service: "trip",

  // Version of the protocol implemented by the service. v1 for all OSRM 5.x installations
  version: "v1",

  // Mode of transportation, is determined statically by the Lua profile that is used to prepare the data using osrm-extract. Typically car, bike or foot if using one of the supplied profiles.
  profile: "car",


  // an array of coordinates that are arrays of 2 elements : [latitude, longitude]
  coords: [
    [
      43.91681, 2.1382 // Ateliers Municipaux Charcot
    ],
    [
      43.92712, 2.14642 // Hôtel de Ville
    ],
    [
      43.9409, 2.1185 // Golf de Lasbordes
    ],
    [
      43.9176354, 2.1101724 // Buffalo Grill
    ],
    [
      43.92501, 2.14969 // CCAS
    ],
    [
      43.9216692, 2.1660809 // Stadium
    ],
    [
      43.9536903, 2.1717809 // Mairie de Lescure-d'Albigeois
    ],
    [
      43.92956, 2.16142 // random address
    ],
    [
      43.94173, 2.1456 // random address
    ],
    [
      43.94494, 2.13718 // random address
    ],
    [
      43.90874, 2.11212 // Mairie du Sequestre
    ],
    [
      43.92739, 2.10972 // random address
    ],
    [
      43.93777, 2.08174 // random address
    ],
    [
      43.94865, 2.211 // random address
    ],
    [
      43.92801, 2.22164 // random address
    ],
    [
      43.91255, 2.21254 // random address
    ],
    [
      43.89177, 2.17134 // random address
    ]
  ],

  /*
      steps : Return route steps for each route leg

      geometries : Returned route geometry format (influences overview and per step)

      roundtrip : Return route is a roundtrip
      source : Return route starts at `any` or `first` coordinate
      destination : Return route ends at `any` or `last` coordinate
      if source=any&destination=any the returned round-trip will still start at the first input coordinate by default.

      overview : Add overview geometry either `full`, `simplified` according to highest zoom level it could be display on, or not at all (`false`).
  */
  options: {
    steps: false,
    geometries: "geojson", // Returned route geometry in Geojson for Leaflet
    overview: "full" // full overview geometry
  }

};


/**
 *
 *
 * returns a Promise which is fulfilled with the trip array when the OSRM server answers
 */
function getTrip() {

  let madeUrl = makeUrl(osrmReq);

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
