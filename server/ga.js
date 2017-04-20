'use strict';

const db = require('./db.js');
const osrm = require('./osrm.js');

const POPULATION_SIZE = 100;

function firstPopulation(nbTrips) {

  return new Promise((resolve, reject) => {

    db.getFullAddressesData()
      .then((addressesGeoJson) => {

        osrm.getTableFromAddresses(addressesGeoJson)
          .then((table) => {

            let population = [];

            for (let i = 0; i < POPULATION_SIZE; ++i) {

              osrm.greedyChunk(addressesGeoJson, nbTrips, table)
                .then((partition) => {

                  population.push(partition);

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

  console.log("population genérée en : " + (Date.now() - bef)/1000 + " sec");

});
