'use strict';

const db = require('./db.js');
const osrm = require('./osrm.js');
const utils = require('./utils.js');

const POPULATION_SIZE = 1;


/** On represente un sous ensemble avec un tableau de valeurs booleenes
 *
 * avec le ieme element du tableau egal vrai
 * si et seulement si la ieme adresse est inclue dans ce sous ensemble
 *
 * une partition est alors une liste de n sous ensembles,
 * n etant le nombre de trajets
 *
 */
class Partition {

  constructor(trips) {

    this.trips = trips;

    // les durees additionnees des trajets en secondes
    this.totalDuration = 0.0;

    for (let trip of trips) {
      this.totalDuration += trip.route.duration;
    }

  }

}


firstPopulation(3);


function firstPopulation(nbTrips) {

  return new Promise((resolve, reject) => {

    db.getFullAddressesData()
      .then((addressesGeoJson) => {

        console.log(addressesGeoJson);

        osrm.getTableFromAddresses(addressesGeoJson)
          .then((table) => {

            let population = [];

            for (let i = 0; i < POPULATION_SIZE; ++i) {

              console.log('partitioning #' + i);

              greedyChunk(addressesGeoJson, nbTrips, table)
                .then(osrm.computeAllTrips)
                .then((trips) => {

                  console.log(trips[0].addresses);
                  console.log('computed trip #' + i);

                  population.push(new Partition(trips));

                  if (population.length == POPULATION_SIZE) {

                    // console.log(population);
                    population.sort((a, b) => {
                      return a.totalDuration - b.totalDuration
                    });
                    resolve(population);
                  }

                });
            }

          });
      });

  });
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

    osrm.removeDestination(dur, firstId);

    // chaque "ligne" de durationsTable est de meme taille
    // et removeDestination enleve un element de chaque "ligne"
    console.log('picking destinations');
    while (dur[firstId].length > 0) {

      for (let i = 0; i < nbTrips-1 && dur[firstId].length > 0; ++i) {

        let lastDest = trips[i][trips[i].length - 1];
        // on recupere la destination en fin de liste,
        // qui devient la source pour al prochaine


        // plus une destionation est proche de notre source, plus elle a de chance d'etre choisie
        let nextDest = osrm.pickDestination(dur[lastDest.id]);

        if(nextDest.dest_feature.properties.town == '81000 ALBI') {
          trips[i].push(nextDest.dest_feature);
          // console.log('aaaaaa');
        }
        else {
          trips[nbTrips-1].push(nextDest.dest_feature);
          // console.log('fqsf');
        }

        osrm.removeDestination(dur, nextDest.destination_id);
      }
    }
    console.log('partitioning done');
    resolve(trips);

  });

}


function bestPartitionFromPop(nbTrips) {

  let bef = Date.now();

  console.log('generating a population of ' + POPULATION_SIZE + ' partitions');

  return firstPopulation(nbTrips).then((population) => {

    let totalTime = (Date.now() - bef);

    let avgTime = totalTime / POPULATION_SIZE;

    console.log("population generated in : " + totalTime / 1000 + " sec");

    console.log('average of ' + Math.ceil(avgTime) / 1000 + ' sec per partition');



    // console.log(population[0].trips);

    let addresses = [];

    for (let trip of population[0].trips) {
      addresses.push(trip.addresses.features)
    }

    return osrm.computeAllTrips(addresses, true);

  });

}

// bestPartitionFromPop(6).then((partition) => {

//   console.log('ok');

//   console.log(partition);
// });


exports.getTrips = bestPartitionFromPop;
