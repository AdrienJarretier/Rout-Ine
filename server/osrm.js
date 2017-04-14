'use strict';

const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const request = require('request');
const db = require('./db.js');
const shuffle = require('shuffle-array');
const utils = require('./utils.js');
const Random = require("random-js");
const mt = Random.engines.mt19937().autoSeed();

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
 * @param {GeoJson FeatureCollection object} addressesGeoJson collection de AddressFeature
 *
 * @returns {Promise} la promesse realisee avec le voyage quand le serveur OSRM repond
 */
function getTripFromAddresses(addressesGeoJson) {

  return new Promise((resolve, reject) => {

    let oReq = new OsrmRequest('trip');

    oReq.setFromAddresses(addressesGeoJson);

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

/**
 * @param {GeoJson FeatureCollection object} addressesGeoJson collection de AddressFeature
 *
 * @returns {Promise} la promesse realisee avec la matric de durees quand le serveur OSRM repond
 */
function getTableFromAddresses(addressesGeoJson) {

  return new Promise((resolve, reject) => {

    let oReq = new OsrmRequest('table');

    oReq.setFromAddresses(addressesGeoJson);

    let url = oReq.makeUrl();

    console.log('url length : ' + url.length);

    request(url, (error, response, body) => {

      if (error) {
        console.log('error:', error); // Print the error if one occurred
        console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
      } else {

        console.log('body length : ' + body.length);

        let response = JSON.parse(body);

        let durations = [];

        for (let i = 0; i < response.durations.length; ++i) {

          let uniDurations = [];

          let maxDuration = 0.0;

          for (let j = 0; j < response.durations[i].length; ++j) {

            if (i != j) {
              uniDurations.push({
                dur: response.durations[i][j],
                source_id: addressesGeoJson.features[i].id,
                destination_id: addressesGeoJson.features[j].id,
                dest_feature: addressesGeoJson.features[j]
              });

              if (response.durations[i][j] > maxDuration)
                maxDuration = response.durations[i][j];
            }

          }

          uniDurations.sort((a, b) => {
            return a.dur - b.dur
          });

          let cumulatedFitness = 0.0;

          // pour chaque destination on va ajotuer un attribut d'aptitude
          for (let uniDur of uniDurations) {

            uniDur.fitness = maxDuration / uniDur.dur;

            cumulatedFitness += uniDur.fitness;

            uniDur.cumulatedFitness = cumulatedFitness;
          }

          durations[addressesGeoJson.features[i].id] = uniDurations;
        }

        console.log(durations);
        resolve(durations);

      }
    });

  });

}

getHalfTrip(2);

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

  // i prend la valeur des cles de durations qui ne sont pas contigues
  for (let i in durations) {

    for (let j = 0; j < durations[i].length; ++j) {


      if (durations[i][j].destination_id == dest_id) {
        durations[i].splice(j, 1);
        break;
      }
    }
  }
}

/**
 * decoupe l'objet addressesGeoJson en <nbTrips> tableaux
 * avec un algorithme glouton qui fait appel a la matrice de durees entre toutes les coordonnees
 *
 * @param {GeoJson FeatureCollection object} addressesGeoJson, l'objet geoJson correspondant a une collection de AddressFeature
 * @param {Integer} nbTrips le nombre de sous tableaux demandes
 * @param {2d array} durationsTable la matrice des durees de trajet entre les adresses
 *
 * @returns {Promise} la promesse qui se resoudra avec un tableau 2D [num voyage][AddressFeature]
 */
function greedyChunk(addressesGeoJson, nbTrips, durationsTable) {

  return new Promise((resolve, reject) => {

    // let bef = Date.now();

    let dur = utils.clone(durationsTable); // copie du tableau

    // console.log("copié en : " + (Date.now()-bef) + " ms");

    let trips = [];

    for (let i = 0; i < nbTrips; ++i) {
      trips.push([addressesGeoJson.features[0]]);

    }


    let firstId = addressesGeoJson.features[0].id;

    removeDestination(dur, addressesGeoJson.features[0].id);


    while (dur[firstId].length > 0) {

      for (let i = 0; i < nbTrips && dur[firstId].length > 0; ++i) {


        let lastDest = trips[i][trips[i].length - 1];
        // on recupere la destination en fin de liste,
        // qui devient la source pour al prochaine



        // la prochaine destination est la plus proche de notre source
        let nextDest = dur[lastDest.id][0];

        trips[i].push(nextDest.dest_feature);

        removeDestination(dur, nextDest.destination_id);
      }
    }

    resolve(trips);

  });

}

/**
 * En entree un tableau 2D, demande a OSRM un calcul de voyage pour chaque partition
 *
 * @param {array} tableau 2D [num voyage][AddressFeature], les adresses partitionnees
 *
 * @return {Promise}
 */
function computeAllTrips(addressesChunks) {

  return new Promise((resolve, reject) => {
    let resultTrips = []; // tableau d'instances de ResultTrip

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

          if (resultTrips.length == addressesChunks.length)
            resolve(resultTrips);
        });

    }
  });
}

function getHalfTrip(nbTrips) {

  return db.getFullAddressesData()
    .then((addressesGeoJson) => {

      return getTableFromAddresses(addressesGeoJson)
        .then((table) => {

          return greedyChunk(addressesGeoJson, nbTrips, table);

        })
        .then(computeAllTrips);
    });

}


exports.getTrips = getHalfTrip;
