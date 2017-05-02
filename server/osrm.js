'use strict';


const async = require('async');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const request = require('request');
const db = require('./db.js');
const shuffle = require('shuffle-array');
const utils = require('./utils.js');
const Random = require("random-js");
const mt = Random.engines.mt19937().autoSeed();

/**
 * Represente une requete pour le serveur osrm
 */
class OsrmRequest {
  constructor(service, requestOverview) {

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
    this.options = {};

    if (service == 'route' || service == 'trip') {

      if (requestOverview == undefined)
        requestOverview = false;

      this.options = {
        steps: false,
        geometries: "geojson", // Returned route geometry in Geojson for Leaflet
        overview: (requestOverview ? 'full' : 'false') // overview geometry
      };

    }
    if (service == 'route') {
      this.options['continue_straight'] = false;
    }

    // switch (service) {

    //   case 'trip':
    //   case 'route':

    //     if (requestOverview == undefined)
    //       requestOverview = false;

    //     this.options = {
    //       steps: false,
    //       geometries: "geojson", // Returned route geometry in Geojson for Leaflet
    //       overview: (requestOverview ? 'full' : 'false') // overview geometry
    //     };
    //     break;

    //   case 'route':
    //     this.options['continue_straight'] = false;
    //     break

    //   default:
    //     this.options = {};
    //     break;

    // }
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


    // console.log(' **requestUrl** ');
    // console.log(requestUrl);

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

    // coordinates est un getter dans AddresseFeature pour acceder directement a geometry.coordinates
    for (let c of addresses.features) {
      // console.log(c);
      this.addCoords(c.coordinates[1], c.coordinates[0]);
    }

  }

}

let requestsQ = async.queue(function(task, callback) {

  // console.log('request to osrm ' + task.oReq.service + ' service');
  request(task.oReq.makeUrl(), (error, response, body) => {

    if (error) {
      console.log('error:', error); // Print the error if one occurred
      console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
    } else {

      // console.log('response from ' + task.oReq.service + ' service');
      let response = JSON.parse(body);
      callback(response);

    }
  });

}, 8);

/**
 * @param {GeoJson FeatureCollection object} addressesGeoJson collection de AddressFeature
 * @param {boolean} fullOverview retourne l'apercu complet du trajet (utilise pour l'affichage sur une carte
 *
 * @returns {Promise} la promesse realisee avec le voyage quand le serveur OSRM repond
 */
function getTripFromAddresses(addressesGeoJson, fullOverview) {

  return new Promise((resolve, reject) => {

    let oReq = new OsrmRequest('trip', fullOverview);

    oReq.setFromAddresses(addressesGeoJson);

    requestsQ.push({ oReq: oReq }, function(response) {

      resolve(response);
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

    requestsQ.push({ oReq: oReq }, function(response) {


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
              dest_feature: addressesGeoJson.features[j],
              fitness: 0.0,
              cumulatedFitness: 0.0
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

          if (uniDur.dur > 0)
            uniDur.fitness = maxDuration / uniDur.dur;

          cumulatedFitness += uniDur.fitness;

          uniDur.cumulatedFitness = cumulatedFitness;
        }

        durations[addressesGeoJson.features[i].id] = uniDurations;
      }

      resolve(durations);
    });


  });

}

/**
 * Represente un sous-ensemble d'adresses, qui est un voyage
 */
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

        // pour chaque element situe apres celui que l'on va retirer,
        // on soustrait a son score d'aptitude cumule le score d'aptitude de l'emement qui va disparaitre
        for (let k = j + 1; k < durations[i].length; ++k) {
          durations[i][k].cumulatedFitness -= durations[i][j].fitness;
        }

        durations[i].splice(j, 1);
        break;
      }
    }
  }
}

/**
 * Pioche une destination parmis la liste de destinations recu
 * tirage aleatoire avec le score d'aptitude des destinations
 *
 * @param durationsLine {array} une ligne de la matrice de durees resultantes de getTableFromAddresses
 *
 * @return {object} l'objet durations tire au sort
 */
function pickDestination(durationsLine) {

  if (durationsLine[0].dur == 0) {

    return durationsLine[0]

  } else {

    let maxCumulatedFitness = durationsLine[durationsLine.length - 1].cumulatedFitness;

    // console.log('maxCumulatedFitness : ' + maxCumulatedFitness);
    let pickedFit = Random.real(0, maxCumulatedFitness, true)(mt);

    let j = 0;

    let currentCumulFit = durationsLine[j].cumulatedFitness;

    while (pickedFit > currentCumulFit) {

      currentCumulFit = durationsLine[++j].cumulatedFitness;
    }

    return durationsLine[j];
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

    // toujours commencer par la premiere adresse, le depot
    for (let i = 0; i < nbTrips; ++i) {
      trips.push([addressesGeoJson.features[0]]);
    }


    let firstId = addressesGeoJson.features[0].id;

    removeDestination(dur, firstId);

    // chaque "ligne" de durationsTable est de meme taille
    // et removeDestination enleve un element de chaque "ligne"
    console.log('picking destinations');
    while (dur[firstId].length > 0) {

      for (let i = 0; i < nbTrips - 1 && dur[firstId].length > 0; ++i) {

        let lastDest = trips[i][trips[i].length - 1];
        // on recupere la destination en fin de liste,
        // qui devient la source pour al prochaine


        // plus une destionation est proche de notre source, plus elle a de chance d'etre choisie
        let nextDest = pickDestination(dur[lastDest.id]);

        if (nextDest.dest_feature.properties.town == '81000 ALBI') {
          trips[i].push(nextDest.dest_feature);
          // console.log('aaaaaa');
        } else {
          trips[nbTrips - 1].push(nextDest.dest_feature);
          // console.log('fqsf');
        }

        removeDestination(dur, nextDest.destination_id);
      }
    }
    console.log('partitioning done');
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
function computeAllTrips(addressesChunks, fullOverview) {

  // console.log('addressesChunks : ');
  // console.log(addressesChunks);

  return new Promise((resolve, reject) => {
    let resultTrips = []; // tableau d'instances de ResultTrip

    let resultsCount = 0;

    for (let j in addressesChunks) {
      let chunk = addressesChunks[j];
      // for (let chunk of addressesChunks) {

      let result = new ResultTrip();

      result.setAddressFeatures(chunk);

      getTripFromAddresses(result.addresses, fullOverview)
        .then((trip) => {

          // pour chaque adresse on recupere sa position dans le trajet
          for (let i = 0; i < trip.waypoints.length; ++i) {

            let w_ind = trip.waypoints[i].waypoint_index;
            result.addresses.features[i].setWaypointIndex(w_ind);
          }

          result.setTrip(trip.trips[0]);
          resultTrips[j] = result;

          ++resultsCount;

          if (resultsCount == addressesChunks.length)
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
        .then((addressesChunks) => {
          return computeAllTrips(addressesChunks, true)
        });
    });

}


exports.computeAllTrips = computeAllTrips;
exports.getTrips = getHalfTrip;
exports.getTableFromAddresses = getTableFromAddresses;
exports.getTripFromAddresses = getTripFromAddresses;
exports.OsrmRequest = OsrmRequest;
exports.pickDestination = pickDestination;
exports.removeDestination = removeDestination;
