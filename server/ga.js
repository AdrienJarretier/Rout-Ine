'use strict';

const db = require('./db.js');
const osrm = require('./osrm.js');

const POPULATION_SIZE = 80;

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

function firstPopulation(nbTrips) {

  return new Promise((resolve, reject) => {

    db.getFullAddressesData()
      .then((addressesGeoJson) => {

        osrm.getTableFromAddresses(addressesGeoJson)
          .then((table) => {

            let population = [];

            for (let i = 0; i < POPULATION_SIZE; ++i) {

              osrm.greedyChunk(addressesGeoJson, nbTrips, table)
                .then(osrm.computeAllTrips)
                .then((trips) => {

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

function bestPartitionFromPop(nbTrips) {

  let bef = Date.now();

  return firstPopulation(nbTrips).then((population) => {

    let addressesCount = population[0].trips[0].addresses.features.length * population[0].trips.length;

    let totalTime = (Date.now() - bef);

    let avgTime = totalTime / addressesCount / POPULATION_SIZE;

    console.log("population generated in : " + totalTime / 1000 + " sec");

    console.log('average of ' + avgTime + ' ms per address');



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
