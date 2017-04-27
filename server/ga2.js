'use strict';

const db = require('./db.js');
const FeatureCollection = require('./FeatureCollection.js');
const osrm = require('./osrm.js');

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

  constructor(trips) {

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

function firstPopulation(nbTrips) {

  return new Promise((resolve, reject) => {

    db.getFullAddressesData()
      .then((addressesGeoJson) => {

        let sub = new Subset(addressesGeoJson);

        sub.computeTrip().then(() => {
          console.log(sub);
        });


      });

  });
}
