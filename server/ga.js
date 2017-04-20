'use strict';

const db = require('./db.js');
const osrm = require('./osrm.js');


  // db.getFullAddressesData()
  //   .then((addressesGeoJson) => {

  //     osrm.getTableFromAddresses(addressesGeoJson)
  //       .then((table) => {

  //         console.log(table);

  //       });
  //   });


  db.getFullAddressesData()
    .then(osrm.getTableFromAddresses)
    .then((table) => {

          console.log(table);

        })
