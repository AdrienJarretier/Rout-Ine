'use strict';

const db = require('./db.js');
const FeatureCollection = require('./FeatureCollection.js');
const osrm = require('./osrm.js');
const utils = require('./utils.js');

const POPULATION_SIZE = 22;
const ELITISM_PERCENT = 7 / 100;

const ELECTED_COUNT = Math.round(POPULATION_SIZE * ELITISM_PERCENT);

/**
 * en fonction du pourcentage d'elitisme,
 * retourne une liste des partitions
 * qui se retrouveront automatiquement dans la generation suivante
 */
function elect(population) {

  return population.slice(0, ELECTED_COUNT);

}

firstPopulation(6)
  .then((pop) => {

    console.log("elected count : " + ELECTED_COUNT);

    for (let part of elect(pop))
      console.log(part);

  });



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

  }

  computeAllTrips() {

    return new Promise((resolve, reject) => {

      let tripsComputed = 0;

      for (let subset of this.subsets) {

        subset.computeTrip()
          .then(() => {

            this.totalDistance += subset.distance;
            this.totalDuration += subset.duration;

            if (++tripsComputed == this.subsets.length) {

              // si tous les trajets ont ete calcules
              // on peut trier la partition pour avoir les meilleurs sous ensembles en premier
              // avant de resoudre la promesse

              this.subsets.sort((a, b) => {
                return a.duration - b.duration
              });

              // console.log('****************** subsets durations ********************');

              // for(let sub of this.subsets)
              //   console.log(sub.duration);

              resolve(this);
            }


          });

      }

    });

  }

}

class Subset {

  constructor(addressesGeoJson) {

    // la reference vers la FeatureCollection avec les adresses
    this.addressesGeoJson = addressesGeoJson;

    this.chrom = new Array(addressesGeoJson.features.length).fill(false);

    this.distance = 0.0;
    this.duration = 0.0;

    this.lastAddressId; // utilise par greedyChunk

  }

  /**
   * recherche dans this.addressesGeoJson l'adresse portant l'id donne en parametre
   * recupere la position dans le tableau et cette meme position dans this.chrom est mise a vrai
   *
   * @param {Integer} addrId l'id de l'adresse a ajouter a ce sous ensemble
   */
  addAddress(addrId) {

    // console.log('add : ' + addrId);

    for (let i in this.addressesGeoJson.features) {

      if (this.addressesGeoJson.features[i].id == addrId) {

        // console.log('found at : ' + i);
        this.chrom[i] = true;
        break;

      }

    }

    this.lastAddressId = addrId;

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

function firstPopulation(nbTrips) {

  return new Promise((resolve, reject) => {

    db.extractNamesList('tour1and2.csv')
      .then(db.getFullAddressesData)
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

              greedyChunk(addresses.albi, nbTrips, table, i)
                .then((partition) => {

                  return partition.computeAllTrips();

                })
                .then((partition) => {

                  console.log('partitioning #' + i + ' trip computed, done');

                  // console.log(partition);

                  population.push(partition);

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

    let dur = utils.clone(durationsTable); // copie du tableau

    let partition = new Partition();

    let startAddress = addressesGeoJson.features[0];
    let firstId = startAddress.id;

    console.log('-------------------------------------------------------');

    // // toujours commencer par la premiere adresse, le depot
    for (let i = 0; i < nbTrips; ++i) {
      let sub = new Subset(addressesGeoJson);
      sub.addAddress(firstId);
      partition.push(sub);
    }

    osrm.removeDestination(dur, firstId);


    // chaque "ligne" de durationsTable est de meme taille
    // et removeDestination enleve un element de chaque "ligne"
    console.log('picking destinations');
    while (dur[firstId].length > 0) {

      let i = osrm.Random.integer(0, nbTrips - 1)(osrm.mt);

      let sourceId = partition.subsets[i].lastAddressId;
      // on recupere l'id de la derniere adresse ajoutee,
      // qui devient la source pour la prochaine

      // plus une destionation est proche de notre source, plus elle a de chance d'etre choisie
      let nextDest = osrm.pickDestinationFitness(dur[sourceId]);

      partition.subsets[i].addAddress(nextDest.destination_id);

      osrm.removeDestination(dur, nextDest.destination_id);

    }
    console.log('partitioning done');
    resolve(partition);

  });

}
