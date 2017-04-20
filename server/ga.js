'use strict';

const db = require('./db.js');
const osrm = require('./osrm.js');

const POPULATION_SIZE = 10;

class Partition {

  constructor(trips) {

    this.trips = trips;

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
                    resolve(population);
                  }

                });
            }

          });
      });

  });
}

let bef = Date.now();

firstPopulation(6).then((population) => {

  let addressesCount = population[0].trips[0].addresses.features.length * population[0].trips.length;

  let totalTime = (Date.now() - bef);

  let avgTime = totalTime / addressesCount / POPULATION_SIZE;

  console.log("population generated in : " + totalTime / 1000 + " sec");

  console.log('average of ' + avgTime + ' ms per address');

});
