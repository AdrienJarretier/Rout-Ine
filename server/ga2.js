'use strict';

const common = require('./common.js');
const db = require('./db.js');
const FeatureCollection = require('./FeatureCollection.js');
const osrm = require('./osrm.js');
const utils = require('./utils.js');

/*
if (!process.argv[2])
  console.log("provide population size");
else
  firstPopulation(2)
  .then((pop) => {

    console.log('initial generation');
    console.log(pop);

    reproduceForever(pop);

  });
*/

let forever;

exports.stop = function() {

  forever = false;

}

exports.start = function(nbTrips, socket) {

  console.log('initial generation');
  firstPopulation(nbTrips)
    .then((pop) => {

      console.log(' ************** initial pop ready ************** ');

      console.log(pop[0]);
      sendToClient(pop[0], (Date.now() - timeStart));

      reproduceForever(pop);

    });

  const POPULATION_SIZE = 2;
  const ELITISM_PERCENT = 7 / 100;

  const ELECTED_COUNT = Math.round(POPULATION_SIZE * ELITISM_PERCENT);

  const MAX_GEN_WITHOUT_BETTER = Infinity;

  const MAX_REJECT = Infinity;

  let idealNbElementsInSubset; // calcule dans firtPopuplation apres avoir pris connaissance du nombre d'adresses et du nbTrips demande

  /**
   * en fonction du pourcentage d'elitisme,
   * retourne une liste des partitions
   * qui se retrouveront automatiquement dans la generation suivante
   */
  function elect(population) {

    return population.slice(0, ELECTED_COUNT);

  }

  forever = true;

  // process.on('SIGINT', function() {

  //   console.log('terminating');

  //   forever = false;
  // });

  let genCount = 1;
  let lastTotalDuration = Infinity;
  let bestPartition;
  let timeStart = Date.now();
  let timeLastBest = Date.now();

  let bestResult = {
    genNumber: 0,
    partitionId: 0,
    totalTime: 0,
    trips: []
  }

  function sendToClient(partition, totalTime) {

    if (partition.totalDuration < lastTotalDuration) {

      lastTotalDuration = partition.totalDuration;

      bestPartition = partition;

      timeLastBest = Date.now();
      bestResult.genNumber = genCount;
      bestResult.partitionId = partition.id;
      bestResult.totalTime = totalTime;
      bestResult.trips = partition.trips;

      common.writeJson(common.serverConfig.resultsFolder + "/bestTours.json", bestResult);

      socket.emit('bestResult', bestResult);

      console.log('best : ');
      console.log(partition);

      for (let sub of partition.subsets) {

        let countElementsInSubset = sub.chrom.reduce(
          (acc, cur) => {

            if (cur)
              acc++;

            return acc;

          }, 0);

        console.log('');
        console.log(countElementsInSubset);
      }

    }

  }

  function reproduceForever(initialPop) {

    nextGeneration(initialPop)
      .then((nextGen) => {

        let totalTime = (Date.now() - timeStart);

        console.log(' ************** generation ' + (++genCount) + ' Born ************** ');
        console.log('');

        sendToClient(nextGen[0], totalTime);

        if (forever && bestResult.genNumber + MAX_GEN_WITHOUT_BETTER > genCount)
          reproduceForever(nextGen);
        else {
          console.log('best partition found : ');
          console.log(bestPartition);

          let timeSinceBest = (Date.now() - timeLastBest);

          console.log(timeSinceBest / 1000 + ' sec without better result');
          console.log(totalTime / 1000 + ' sec total');

          // process.on('SIGINT', function() {

          //   process.exit(0);
          // });
        }
      });
  }

  /*
    function acceptChild(partition) {

      let notOneEmpty = true;

      // le nombre minimal d'elements dans un sous ensemble pour qu'il soit accepté
      const MIN_ELEMENTS = 10;

      for (let sub of partition.subsets) {

        let empty = true;

        let count = 0;

        let c = sub.chrom;
        for (let i = 0; i < c.length; ++i) {

          if (c[i] && ++count == MIN_ELEMENTS) {
            empty = false;
            break;
          }
        }
        if (empty) {
          notOneEmpty = false;
          break;
        }

      }

      return notOneEmpty;

    }
  */

  function nextGeneration(currentPop) {

    return new Promise((resolve, reject) => {

      console.log('');
      console.log(' **************** nextGeneration **************** ');

      let pop = elect(currentPop);

      let rejectedCount = 0;
      while (pop.length < POPULATION_SIZE) {
        let child = mate(weightedRouletteWheel(currentPop), weightedRouletteWheel(currentPop));

        pop.push(child);

        // if (acceptChild(child))
        //   pop.push(child);
        // else if (++rejectedCount >= MAX_REJECT)
        //   forever = false;
      }

      let promises = [];

      for (let part of pop) {

        promises.push(part.computeAllTrips());
      }

      Promise.all(promises)
        .then(() => {

          applyPartitionsFitness(pop);

          mutate(pop);

          applyPartitionsFitness(pop);

          resolve(pop);

        });

    });

  }

  function mutate(population) {

    /**
     *  Selection aleatoirement un des element de la partition donnee (une adresse, la premiere exclue)
     *  et le place dans un subset aleatoire
     */
    function moveRandomElement(partition) {

      // recuperons l'id maximal des adresses
      let max = partition.subsets[0].addressesGeoJson.features.length - 1;

      // on pioche un nombre entre 1 (car on exclu la premiere adresses) et max
      let picked = common.Random.integer(1, max)(common.mt);

      // on ne sait pas dans quel subset est l'element, donc on va simplement mettre a faux cette position dans tous
      for (let sub of partition.subsets)
        sub.chrom[picked] = false;

      // et enfin on choisit un subset aleatoire dans lequel placer notre picked
      let subsetPicked = common.Random.integer(0, partition.subsets.length - 1)(common.mt);

      partition.subsets[subsetPicked].chrom[picked] = true;

    }

    // les tailles des bandes
    let bandsSizes = [

      ELECTED_COUNT,
      Math.round(POPULATION_SIZE * 33 / 100),
      Math.round(POPULATION_SIZE * 30 / 100),

    ];

    // le nombre de mutations que chaque partition de la bande correspondante subira
    // avec la probabilité de mutation associee
    let mutationsParameters = [

      {
        mutationsCount: 1,
        mutationProbability: 10 / 100
      },

      {
        mutationsCount: 4,
        mutationProbability: 50 / 100
      },

      {
        mutationsCount: 10,
        mutationProbability: 50 / 100
      },

      {
        mutationsCount: 20,
        mutationProbability: 50 / 100
      }

    ]

    let bands = [];
    let sliceStart = 0;

    for (let i = 0; i < bandsSizes.length; ++i) {

      bands.push(population.slice(sliceStart, sliceStart + bandsSizes[i]));

      sliceStart += bandsSizes[i];
    }

    bands.push(population.slice(sliceStart));


    // pour chaque partition d'un bande on a 'mutationsCount' fois 'mutationProbability' de chances d'effectuer une mutation

    for (let i in bands)
      for (let part of bands[i])
        for (let j = 0; j < mutationsParameters[i].mutationsCount; ++j)
          if (common.Random.bool(mutationsParameters[i].mutationProbability)(common.mt))
            moveRandomElement(part);

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

    // on commence a 1 pour ne pas supprimer l'adresse de depart commune, le ccas
    for (let i = 1; i < subsets[0].chrom.length; ++i) {

      let alreadyFound = false;
      let foundAt;

      for (let j = 0; j < subsets.length; ++j) {

        let sub = subsets[j];

        if (sub.chrom[i])
        // this element belongs to 2 subsets
          if (alreadyFound && sub.duration != subsets[foundAt].duration) {
          // remove it from the more erroneous one

          // c'est l'ensemble courant le plus mauvais, car ils sont tries du meilleur au pire par leur duree
          // et on a deja trouve l'element dans un sous ensemble precedent
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

    // on calule les adresses medianes

    let medians = [];

    for (let sub of subsets) {
      medians.push(sub.medianCoord());
    }

    // on va maintenant placer tous les elements qui ne sont dans aucun sous ensemble
    // dans le sous ensemble dont l'adresse mediane est la plus proche

    for (let j of foundNowhere) {

      let jCoord = subsets[0].addressesGeoJson.features[j].coordinates;

      let distancesWithMedian = [];

      for (let k = 0; k < medians.length; ++k) {

        let dist = utils.distanceBetween(medians[k], jCoord);
        distancesWithMedian.push({ k: k, dist: dist });
      }

      distancesWithMedian.sort((a, b) => {
        return a.dist - b.dist
      });

      subsets[distancesWithMedian[0].k].chrom[j] = true;

    }

    let part = new Partition();

    part.subsets = subsets;

    return part;

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

      this.error = 0.0;

      this.trips = [];

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

      copyPart.error = this.error;

      return copyPart;

    }

    computeAllTrips() {

      return new Promise((resolve, reject) => {

        this.trips.length = 0;
        this.totalDistance = 0;
        this.totalDuration = 0;

        let tripsComputed = 0;

        for (let subset of this.subsets) {

          subset.computeTrip()
            .catch((reason) => {
              /*
              la promesse a ete rejete si osrm n'a pas pu calculer le trajet, 2 cas :
                - trop d'adresses, dans ce cas augmenter le max-trip-size du serveur osrm
                - moins de 2, adresses, alors tuer cet enfant
              */
            })
            .then((tripAndAddresses) => {

              this.trips.push(tripAndAddresses);

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

      this.error = 0.0;

      this.lastAddressId; // utilise par greedyChunk

    }

    copy() {

      let copySub = new Subset(this.addressesGeoJson);

      copySub.chrom = this.chrom.slice();

      copySub.distance = this.distance;
      copySub.duration = this.duration;

      copySub.error = this.error;

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

        osrm.getTripFromAddresses(featColl, true)
          .then((trip) => {

            if (!trip.trips)

              reject(JSON.stringify(trip));

            else {

              trip.trips[0].duration += featColl.features.length * 180;

              this.distance = trip.trips[0].distance;
              this.duration = trip.trips[0].duration;

              let tripAndAddresses = {
                trip: trip,
                addresses: featColl
              }

              resolve(tripAndAddresses);
            }

          });

      });

    }

  }

  function firstPopulation(nbTrips) {

    return new Promise((resolve, reject) => {

      // db.extractNamesList('exampleTours/tour1and2.csv')
      //   .then(db.getFullAddressesData)

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

          let totalAddresses = addresses.albi.length;
          idealNbElementsInSubset = totalAddresses / nbTrips;

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

    population.sort((a, b) => {
      return a.subsets[a.subsets.length - 1].duration - b.subsets[a.subsets.length - 1].duration
    });

    let HIGH = population[population.length - 1].subsets[population[population.length - 1].subsets.length -
      1].duration;

    let cumulatedFitness = 0.0;

    for (let part of population) {

      part.fitness = HIGH / part.subsets[part.subsets.length - 1].duration;
      // part.fitness = HIGH + 1 - part.subsets[part.subsets.length - 1].duration;

      cumulatedFitness += part.fitness;

      part.cumulatedFitness = cumulatedFitness;
    }


    // let maxTotalDuration = population[population.length - 1].totalDuration;

    // let cumulatedFitness = 0.0;



    // let maxPartError = 0.0;

    // for (let part of population) {

    //   let partError = 0.0;
    //   for (let sub of part.subsets) {
    //     let countElementsInSubset = sub.chrom.reduce(
    //       (acc, cur) => {

    //         if (cur)
    //           acc++;

    //         return acc;

    //       }, 0);

    //     sub.error = Math.abs(idealNbElementsInSubset - countElementsInSubset);

    //     partError += Math.pow(sub.error, 2);
    //   }
    //   part.error = Math.sqrt(partError);

    //   if (part.error > maxPartError)
    //     maxPartError = part.error;

    // }

    // for (let part of population) {

    //   // let durationFitness = (maxTotalDuration + 1 - part.totalDuration)/maxTotalDuration;
    //   // let errorFitness = (maxPartError + 1 - part.error)/maxPartError;

    //   let durationFitness = maxTotalDuration/(maxTotalDuration + 1 - part.totalDuration);
    //   let errorFitness = Math.pow(maxPartError,2)/Math.pow((maxPartError + 1 - part.error),2);

    //   part.fitness = durationFitness * errorFitness;

    // }

    // console.log('sorting population by decreasing fitness');
    // population.sort((a, b) => {
    //   return b.fitness - a.fitness
    // });


    // for (let part of population) {

    //   cumulatedFitness += part.fitness;

    //   part.cumulatedFitness = cumulatedFitness;
    // }

  }

  function weightedRouletteWheel(population) {

    let maxCumulatedFitness = population[population.length - 1].cumulatedFitness;

    let pickedFit = osrm.Random.real(0, maxCumulatedFitness, true)(osrm.mt);

    let j = 0;

    let currentCumulFit = population[j].cumulatedFitness;

    while (pickedFit > currentCumulFit) {

      currentCumulFit = population[++j].cumulatedFitness;
    }

    return population[j].copy();

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


}
