'use strict';

const db = require('./db.js');
const FeatureCollection = require('./FeatureCollection.js');
const osrm = require('./osrm.js');
const utils = require('./utils.js');

const POPULATION_SIZE = 1;



let nextPartitionId = 0;
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

  constructor() {

    this.id = nextPartitionId++;

    this.subsets = [];

    // les durees additionnees des trajets en secondes
    this.totalDuration = 0.0;

    // les distances additionnees des trajets en metres
    this.totalDistance = 0.0;

  }

  push(subset) {

    this.subsets.push(subset);

    this.totalDistance += subset.distance;
    this.totalDuration += subset.duration;

  }

}

class Subset {

  constructor(addressesGeoJson) {

    // la reference vers la FeatureCollection avec les adresses
    this.addressesGeoJson = addressesGeoJson;

    this.chrom = new Array(addressesGeoJson.features.length).fill(false);

    this.distance = 0.0;
    this.duration = 0.0;

  }

  computeTrip() {

    return new Promise((resolve, reject) => {

      let featuresArray = [];

      for (let k in this.chrom) {

        if (this.chrom[k]) {
          featuresArray.push(this.addressesGeoJson.features[k]);
        }

      }

      let featColl = new FeatureCollection(featuresArray);

      // console.log(featColl);

      osrm.getTripFromAddresses(featColl, false)
        .then((trip) => {

          this.distance = trip.trips[0].distance;
          this.duration = trip.trips[0].duration;

          resolve();

        });

    });

  }

}

firstPopulation(7);

function firstPopulation(nbTrips) {

  return new Promise((resolve, reject) => {

    db.getFullAddressesData()
      .then((addressesGeoJson) => {

        // la premiere adresse est le depart, c'est l'adresse du ccas,
        // elle est positionne en 1ere position par la fonction getAddresses du module db
        let startAddress = addressesGeoJson.features[0];
        let addresses = {
          albi: new FeatureCollection([startAddress]),
          outside: new FeatureCollection([startAddress])
        }

        for (let i = 1; i < addressesGeoJson.features.length; ++i) {
          let addr = addressesGeoJson.features[i];
          if (addr.properties.town == '81000 ALBI') {
            addresses.albi.push(addr);
          } else {
            addresses.outside.push(addr);
          }
        }

        return addresses;

      })
      .then((addresses) => {

        osrm.getTableFromAddresses(addresses.albi)
          .then((table) => {

            let population = [];






            for (let i = 0; i < POPULATION_SIZE; ++i) {

              console.log('partitioning #' + i);

              greedyChunk(addresses.albi, nbTrips - 1, table, i)
                .then((partition) => {

                  // console.log('keys : ');
                  // for(let key in partition) {
                  //   console.log(key);
                  // }
                  partition.push(addresses.outside.features);
                  return partition;
                })
                .then(osrm.computeAllTrips)
                .then((trips) => {

                  console.log('computed trip #' + i);

                  population.push(new Partition(trips));

                  if (population.length == POPULATION_SIZE) {

                    // console.log(population);

                    console.log('sorting population');
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
 * @param {Integer} partitionNumber le numero de cette partition, utile dans l'algo pour savoir quand on reparti dans d'autres trajets
 *
 * @returns {Promise} la promesse qui se resoudra avec un tableau 2D [num voyage][AddressFeature]
 */
function greedyChunk(addressesGeoJson, nbTrips, durationsTable, partitionNumber) {

  return new Promise((resolve, reject) => {

    let addressesPerTrip = addressesGeoJson.features.length / nbTrips;

    // let bef = Date.now();

    let dur = utils.clone(durationsTable); // copie du tableau

    // console.log("copié en : " + (Date.now()-bef) + " ms");

    let partition = new Partition();

    // let trips = [];

    let startAddress = addressesGeoJson.features[0];

    console.log(startAddress);
    console.log('-------------------------------------------------------');

    // // toujours commencer par la premiere adresse, le depot
    for (let i = 0; i < nbTrips; ++i) {
      let sub = new Subset(addressesGeoJson);
      sub.chrom[0] = true;
      partition.push(sub);
    }

    console.log(partition);


    // let firstId = startAddress.id;

    // osrm.removeDestination(dur, firstId);

    // // chaque "ligne" de durationsTable est de meme taille
    // // et removeDestination enleve un element de chaque "ligne"
    // console.log('picking destinations');
    // while (dur[firstId].length > 0) {

    //   for (let i = 0; i < nbTrips && dur[firstId].length > 0; ++i) {

    //     for (let j = -1; j < (partitionNumber) % (addressesPerTrip) && dur[firstId].length > 0; ++j) {
    //       let lastDest = trips[i][trips[i].length - 1];
    //       // on recupere la destination en fin de liste,
    //       // qui devient la source pour al prochaine


    //       // plus une destionation est proche de notre source, plus elle a de chance d'etre choisie
    //       let nextDest = osrm.pickDestination(dur[lastDest.id]);

    //       trips[i].push(nextDest.dest_feature);

    //       osrm.removeDestination(dur, nextDest.destination_id);
    //     }
    //   }
    // }
    // console.log('partitioning done');
    // // console.log(trips);
    // resolve(trips);

  });

}
