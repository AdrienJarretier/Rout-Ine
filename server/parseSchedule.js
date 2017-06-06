const async = require('async');
const common = require('./common.js');
const db = require('./db.js');
const geocode = require('./geocode.js');
const mysql = require('mysql');
const utils = require('./utils.js');

const dbQuery = db.query;

let addressesInDb = [];
let toursAlreadyComputed = false;

function checkAssignmentTour(address_id, dbCon, lng, lat) {

  return new Promise((resolve, reject) => {

    const sqlSelectTourAssignment =
      ' SELECT * ' +
      ' FROM tour_assignment ' +
      ' WHERE address_id = ? ; ';

    const selectTourAssignment = mysql.format(sqlSelectTourAssignment, [address_id]);

    dbQuery(selectTourAssignment, dbCon)
      .then((rows) => {

        if (rows.length == 0) {

          let distances = [];
          const coordsNewAddress = [lng, lat];

          for (let a of addressesInDb) {

            if (a) {

              const c2 = [a.lng, a.lat]

              const dist = utils.distanceBetween(coordsNewAddress, c2);

              distances.push({
                addressId: a.id,
                dist: dist
              });

            }

          }

          distances.sort((a, b) => {

            return a.dist - b.dist;

          });

          idClosestAddress = distances[0].addressId;

          const selectClosestAddressTourAssignment = mysql.format(sqlSelectTourAssignment, [
            idClosestAddress
          ]);

          dbQuery(selectClosestAddressTourAssignment, dbCon)
            .then((rows) => {

              const tourAssignmentClosest = rows[0];

              const sqlSelectTourAssignmentWithIndex =
                ' SELECT * ' +
                ' FROM tour_assignment ' +
                ' WHERE tour_num = ? AND index_in_tour = ? ; ';

              const selectPreceding = mysql.format(sqlSelectTourAssignmentWithIndex, [
                tourAssignmentClosest.tour_num, tourAssignmentClosest.index_in_tour - 1
              ]);
              const selectNext = mysql.format(sqlSelectTourAssignmentWithIndex, [
                tourAssignmentClosest.tour_num, tourAssignmentClosest.index_in_tour + 1
              ]);

              let promises = [];

              promises.push(dbQuery(selectPreceding, dbCon));
              promises.push(dbQuery(selectNext, dbCon));

              Promise.all(promises)
                .then((precedingAndNext) => {

                  console.log(tourAssignmentClosest);
                  console.log(precedingAndNext);

                  let precedingTourAddress, coordsPreceding, distancePreceding;

                  if (precedingAndNext[0][0]) {
                    precedingTourAddress = addressesInDb[precedingAndNext[0][0].address_id];
                    coordsPreceding = [precedingTourAddress.lng, precedingTourAddress.lat];
                    distancePreceding = utils.distanceBetween(coordsNewAddress, coordsPreceding);
                  }

                  let nextTourAddress, coordsNext, distanceNext;

                  if (precedingAndNext[1][0]) {
                    nextTourAddress = addressesInDb[precedingAndNext[1][0].address_id];
                    coordsNext = [nextTourAddress.lng, nextTourAddress.lat];
                    distanceNext = utils.distanceBetween(coordsNewAddress, coordsNext);
                  }

                  const coordsCCAS = [addressesInDb[0].lng, addressesInDb[0].lat];
                  const distanceCCAS = utils.distanceBetween(coordsNewAddress, coordsCCAS);

                  const sqlUpdateTourAssignments =
                    ' UPDATE tour_assignment ' +
                    ' SET index_in_tour = index_in_tour + 1 ' +
                    ' WHERE tour_num = ? AND index_in_tour > ? ' +
                    ' ORDER BY index_in_tour DESC ; ';

                  if (tourAssignmentClosest.index_in_tour == 1) {

                    if (distanceCCAS < distanceNext) {

                      const updateTourAssignments = mysql.format(sqlUpdateTourAssignments, [
                        tourAssignmentClosest.tour_num, 0
                      ]);

                      dbQuery(updateTourAssignments, dbCon)
                        .then(() => {

                          resolve(db.assignAddressToTour(address_id, tourAssignmentClosest.tour_num,
                            1, dbCon));

                        });

                    } else {

                      const updateTourAssignments = mysql.format(sqlUpdateTourAssignments, [
                        tourAssignmentClosest.tour_num, 1
                      ]);

                      dbQuery(updateTourAssignments, dbCon)
                        .then(() => {

                          resolve(db.assignAddressToTour(address_id, tourAssignmentClosest.tour_num,
                            2, dbCon));

                        });


                    }

                    // si next vide, notre adresse est la derniere de la tournee
                  } else if (precedingAndNext[1].length == 0) {

                    if (distancePreceding < distanceCCAS) {

                      const updateTourAssignments = mysql.format(sqlUpdateTourAssignments, [
                        tourAssignmentClosest.tour_num, tourAssignmentClosest.index_in_tour - 1
                      ]);

                      dbQuery(updateTourAssignments, dbCon)
                        .then(() => {

                          resolve(db.assignAddressToTour(address_id, tourAssignmentClosest.tour_num,
                            tourAssignmentClosest.index_in_tour,
                            dbCon));

                        });

                    } else {

                      resolve(db.assignAddressToTour(address_id, tourAssignmentClosest.tour_num,
                        tourAssignmentClosest.index_in_tour + 1,
                        dbCon));

                    }

                  } else {

                    if (distancePreceding < distanceNext) {

                      const updateTourAssignments = mysql.format(sqlUpdateTourAssignments, [
                        tourAssignmentClosest.tour_num, tourAssignmentClosest.index_in_tour -
                        1
                      ]);

                      dbQuery(updateTourAssignments, dbCon)
                        .then(() => {

                          resolve(db.assignAddressToTour(address_id, tourAssignmentClosest.tour_num,
                            tourAssignmentClosest.index_in_tour,
                            dbCon));

                        });


                    } else {

                      const updateTourAssignments = mysql.format(sqlUpdateTourAssignments, [
                        tourAssignmentClosest.tour_num, tourAssignmentClosest.index_in_tour
                      ]);

                      dbQuery(updateTourAssignments, dbCon)
                        .then(() => {

                          resolve(db.assignAddressToTour(address_id, tourAssignmentClosest.tour_num,
                            tourAssignmentClosest.index_in_tour + 1,
                            dbCon));

                        });

                    }

                  }

                });

            });

        } else
          resolve();

      });

  });

}

function updateAddress(address, dbCon) {

  return new Promise((resolve, reject) => {

    const sqlSelectAddress = ' SELECT * \n' +
      ' FROM address \n' +
      ' WHERE label = ? \n' +
      ' AND town = ? ; ';

    const selectAddress = mysql.format(sqlSelectAddress, [address.label, address.town]);

    dbQuery(selectAddress, dbCon)
      .then((rows) => {

        // si l'adresse est nouvelle on insere
        if (rows.length == 0) {

          geocode(address)
            .then((coords) => {

              const sqlInsertAddress = ' INSERT INTO address(label, town, lat, lng) \n' +
                ' VALUES(?,?,?,?) ; ';

              const insertAddress = mysql.format(sqlInsertAddress, [address.label, address.town,
                coords.lat, coords.lng
              ]);

              dbQuery(insertAddress, dbCon)
                .then((result) => {

                  if (toursAlreadyComputed) {
                    checkAssignmentTour(result.insertId, dbCon, coords.lng, coords.lat)
                      .then(() => {

                        resolve(result.insertId);

                      });
                  } else
                    resolve(result.insertId);

                });

            });

        }
        // sinon on recupere l'id de l'adresse trouvee
        else {

          if (toursAlreadyComputed) {
            checkAssignmentTour(rows[0].id, dbCon, rows[0].lng, rows[0].lat)
              .then(() => {

                resolve(rows[0].id);

              });
          } else
            resolve(rows[0].id);

        }

      });

  });

}

function updatePhones(benefId, phones, dbCon) {

  return new Promise((resolve, reject) => {

    // delete phones for benefId

    const sqlDeletePhones = ' DELETE \n' +
      ' FROM beneficiary_phone \n' +
      ' WHERE beneficiary_id = ? ; ';

    const deletePhones = mysql.format(sqlDeletePhones, [benefId]);

    dbQuery(deletePhones, dbCon)
      .then(() => {

        // insert phones
        const sqlInsertPhone = ' INSERT INTO beneficiary_phone(beneficiary_id, phone_number) \n' +
          ' VALUES(?,?) ; ';

        let promises = [];

        for (let phone of phones) {

          const insertPhone = mysql.format(sqlInsertPhone, [benefId, phone]);
          promises.push(dbQuery(insertPhone, dbCon));

        }

        resolve(Promise.all(promises));

      });

  });

}

// let dbCon = mysql.createConnection(common.serverConfig.db);

// updateAddress({ label: 'test5dd6', town: 'testAlbi' }, dbCon)
//   .then((id) => {

//     dbCon.end();

//   });

function updateBenef(benef, dbCon) {

  return new Promise((resolve, reject) => {

    updateAddress(benef.address, dbCon)
      .then((addressId) => {

        const sqlSelectBenef = ' SELECT * \n' +
          ' FROM beneficiary \n' +
          ' WHERE name = ? AND address_id = ? ; ';

        const selectBenef = mysql.format(sqlSelectBenef, [benef.name, addressId]);

        dbQuery(selectBenef, dbCon)
          .then((rows) => {

            // si ce beneficiaire est nouveau on lance un insert
            if (rows.length == 0) {

              const sqlInsertBenef =
                ' INSERT INTO beneficiary(name, birthdate, address_additional, address_id, note) \n' +
                ' VALUES(?,?,?,?,?) ; ';

              const insertBenef = mysql.format(sqlInsertBenef, [benef.name, benef.birthdate, benef.address_additional,
                addressId, benef.note
              ]);

              return dbQuery(insertBenef, dbCon)
                .then((result) => {

                  return result.insertId;

                });

            } else {

              const sqlUpdateBenef = ' UPDATE beneficiary \n' +
                ' SET birthdate = ?, address_additional = ?, note = ? \n' +
                ' WHERE id = ? ; ';

              const updateBenef = mysql.format(sqlUpdateBenef, [benef.birthdate, benef.address_additional,
                benef.note,
                rows[0].id
              ]);

              return dbQuery(updateBenef, dbCon)
                .then(() => {

                  return rows[0].id;

                });
            }

          })
          .then((benefId) => {

            let promises = [];

            promises.push(updatePhones(benefId, benef.phones, dbCon));
            promises.push(insertDeliveries(benefId, benef.deliveries, dbCon));

            resolve(Promise.all(promises));

          });

      });

  });

}

function insertDeliveries(benefId, deliveriesDates, dbCon) {

  return new Promise((resolve, reject) => {

    const sqlInsertDelivery = ' INSERT IGNORE INTO beneficiary_delivery_date(beneficiary_id, date) \n' +
      ' VALUES(?, ?) ; ';

    let promises = [];

    for (let d of deliveriesDates) {

      let parsedDate = utils.parseDateTime(d, 20);


      const insertDelivery = mysql.format(sqlInsertDelivery, [benefId, parsedDate]);

      promises.push(dbQuery(insertDelivery, dbCon));

    }

    resolve(Promise.all(promises));

  });

}

let updateBenefsQ = async.queue(function(task, callback) {

  updateBenef(task.benef, task.dbCon)
    .then((values) => {

      callback(values);

    });

}, 1);

function updateBeneficiariesFromScheduleList(beneficiariesList, socket) {

  return new Promise((resolve, reject) => {

    db.albiAddresses()
      .then((addresses) => {

        db.getNumberOfTours()
          .then((nbTours) => {


            toursAlreadyComputed = nbTours > 0;

            if (toursAlreadyComputed) {

              addressesInDb;

              for (let a of addresses) {

                addressesInDb[a.id] = a;

              }
            }

            let dbCon = mysql.createConnection(common.serverConfig.db);

            let names = Object.keys(beneficiariesList.beneficiaries);

            for (let i in names) {

              let name = names[i];

              let benef = beneficiariesList.beneficiaries[name];

              updateBenefsQ.push({ benef: benef, dbCon: dbCon }, function(values) {

                socket.emit('percent', i * 100 / names.length);

              });

            }

            updateBenefsQ.drain = function() {

              dbCon.end();

              socket.emit('scheduleProcessed');

              resolve('all beneficiaries have been processed');
            };

          });

      });

  });

}

exports.updateBeneficiariesFromScheduleList = updateBeneficiariesFromScheduleList;

// common.readFile('exampleTours/Edition_des_tournees_par_semaine.csv', 'windows-1252')
//   .then(utils.parseSchedule)
//   .then(getAllBeneficiariesFromDb);
