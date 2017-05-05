'use strict';

const db = require('./db.js');
const FeatureCollection = require('./FeatureCollection.js');
const osrm = require('./osrm.js');
const utils = require('./utils.js');

const POPULATION_SIZE = 2;
const ELITISM_PERCENT = 7 / 100;

const ELECTED_COUNT = Math.ceil(POPULATION_SIZE * ELITISM_PERCENT);

/**
 * en fonction du pourcentage d'elitisme,
 * retourne une liste des partitions
 * qui se retrouveront automatiquement dans la generation suivante
 */
function elect(population) {

  return population.slice(0, ELECTED_COUNT);

}

firstPopulation(2)
  .then((pop) => {

    console.log('initial generation');
    console.log(pop);

    console.log('generation 2');

    let nextGen = nextGeneration(pop);
    // console.log(nextGen);

  });

function nextGeneration(currentPop) {

  let pop = elect(currentPop);

  while (pop.length < currentPop.length)
    pop.push(mate(weightedRouletteWheel(currentPop), weightedRouletteWheel(currentPop)));

  return pop;

}

function mate(parent1, parent2) {

  // collecting best subsets

  let subsets = parent1.subsets.concat(parent2.subsets);


  subsets.sort((a, b) => {
    return a.duration - b.duration
  });

  // console.log('sorted');
  // for (let sub of subsets)
  //   console.log(sub.duration);

  subsets.length /= 2;

  // console.log('culled');
  // for (let sub of subsets)
  //   console.log(sub.duration);


  // repairing subsets

  let foundNowhere = [];

  for (let i = 0; i < subsets[0].chrom.length; ++i) {

    let alreadyFound = false;
    let foundAt;

    for (let j = 0; j < subsets.length; ++j) {

      let sub = subsets[j];

      if (sub.chrom[i])
      // this element belongs to 2 subsets
        if (alreadyFound && sub.duration != subsets[foundAt].duration) {
        // remove it from the more erroneous one

        // c'est l'ensemble courant le plus mauvais, car ils sont tries du meilleur au pire par leur duree
        sub.chrom[i] = false;

        break; // can't be in a third subset because they are disjoint

        // this element belong to 2 subsets with equal duration, lets flip a coin
      } else if (alreadyFound) {

        let indexes = [j, foundAt];

        let indexPicked = osrm.Random.pick(osrm.mt, indexes);

        subsets[indexPicked].chrom[i] = false;

        // console.log(i);
        break; // can't be in a third subset because they are disjoint

      } else {

        alreadyFound = true;
        foundAt = j;
      }

    }

    if (!alreadyFound)
      foundNowhere.push(i);
  }

  subsets[0].medianCoord();

  // for (let sub of subsets)
  //   console.log(sub.chrom);
  // for (let prop in sub)
  //   if(prop != 'addressesGeoJson' && prop != 'chrom')
  //   console.log(prop + ' : ' + sub[prop]);

}



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

    this.fitness = 0.0;
    this.cumulatedFitness = 0.0;

  }

  push(subset) {

    this.subsets.push(subset);

  }

  copy() {

    let copyPart = new Partition();

    for (let sub of this.subsets) {

      copyPart.subsets.push(sub.copy());

    }

    // les durees additionnees des trajets en secondes
    copyPart.totalDuration = this.totalDuration;

    // les distances additionnees des trajets en metres
    copyPart.totalDistance = this.totalDistance;

    copyPart.fitness = this.fitness;
    copyPart.cumulatedFitness = this.cumulatedFitness;

    return copyPart;

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

  copy() {

    let copySub = new Subset(this.addressesGeoJson);

    copySub.chrom = this.chrom.slice();

    copySub.distance = this.distance;
    copySub.duration = this.duration;

    copySub.lastAddressId = this.lastAddressId; // utilise par greedyChunk

    return copySub;

  }

  /**
   * calcule et retourne la coordonnee mediane des adresses inclues dans ce sous ensemble
   *
   * @return {Array} la coordonne mediane [lng, lat]
   */
  medianCoord() {

    let lngs = [];
    let lats = [];

    for (let j = 0; j < this.chrom.length; ++j) {

      if (this.chrom[j]) {

        lngs.push(this.addressesGeoJson.features[j].coordinates[0]);
        lats.push(this.addressesGeoJson.features[j].coordinates[1]);
      }

    }

    lngs.sort();
    lats.sort();

    let medianLngIndex = lngs.length / 2;
    let medianLatIndex = medianLngIndex;

    // si il y a un nombre impair de coordonnees on utilise la moyenne pour savoir quelle valeur mediane choisir
    if (lngs.length % 2 == 1) {

      let avgLng = lngs.reduce(
        (acc, cur) => acc + cur,
        0
      ) / lngs.length;

      let avgLat = lats.reduce(
        (acc, cur) => acc + cur,
        0
      ) / lats.length;

      medianLngIndex =
        (lngs[medianLngIndex] < avgLng ?
          Math.ceil(medianLngIndex) :
          Math.floor(medianLngIndex));

      medianLatIndex =
        (lngs[medianLatIndex] < avgLat ?
          Math.ceil(medianLatIndex) :
          Math.floor(medianLatIndex));
    }

    let medianCoord = [lngs[medianLngIndex], lats[medianLatIndex]];

    // console.log(lngs);
    // console.log(lats);
    // console.log(medianCoord);

    return medianCoord;

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

                    applyPartitionsFitness(population);
                    resolve(population);
                  }

                });
            }

          });

      });

  });
}

function applyPartitionsFitness(population) {

  let maxTotalDuration = population[population.length - 1].totalDuration;

  let cumulatedFitness = 0.0;

  for (let part of population) {

    part.fitness = maxTotalDuration / part.totalDuration;

    cumulatedFitness += part.fitness;

    part.cumulatedFitness = cumulatedFitness;

  }

}

function weightedRouletteWheel(population) {

  let maxCumulatedFitness = population[population.length - 1].cumulatedFitness;

  let pickedFit = osrm.Random.real(0, maxCumulatedFitness, true)(osrm.mt);

  let j = 0;

  let currentCumulFit = population[j].cumulatedFitness;

  while (pickedFit > currentCumulFit) {

    currentCumulFit = population[++j].cumulatedFitness;
  }

  return population[0].copy();

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
