const async = require('async');
const common = require('./common.js');
const db = require('./db.js');
const geocode = require('./geocode.js');
const mysql = require('mysql');
const utils = require('./utils.js');

const dbQuery = db.query;

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

                  resolve(result.insertId);

                });

            });

        }
        // sinon on recupere l'id de l'adresse trouvee
        else {

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
//     console.log(id);

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
                ' INSERT INTO beneficiary(name, address_additional, address_id, note) \n' +
                ' VALUES(?,?,?,?) ; ';

              const insertBenef = mysql.format(sqlInsertBenef, [benef.name, benef.address_additional,
                addressId, benef.note
              ]);

              return dbQuery(insertBenef, dbCon)
                .then((result) => {

                  return result.insertId;

                });

            } else {

              const sqlUpdateBenef = ' UPDATE beneficiary \n' +
                ' SET address_additional = ?, note = ? \n' +
                ' WHERE id = ? ; ';

              const updateBenef = mysql.format(sqlUpdateBenef, [benef.address_additional, benef.note,
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

      let parsedDate = utils.parseDateTime(d);
      console.log(parsedDate);
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

function updateBeneficiariesFromScheduleList(beneficiariesList) {

  return new Promise((resolve, reject) => {

    let dbCon = mysql.createConnection(common.serverConfig.db);

    for (let name in beneficiariesList.beneficiaries) {

      let benef = beneficiariesList.beneficiaries[name];

      updateBenefsQ.push({ benef: benef, dbCon: dbCon }, function(values) {

        // console.log(values);

      });

    }

    updateBenefsQ.drain = function() {

      dbCon.end();
      resolve('all beneficiaries have been processed');
    };

  })

}

exports.updateBeneficiariesFromScheduleList = updateBeneficiariesFromScheduleList;

// common.readFile('exampleTours/Edition_des_tournees_par_semaine.csv', 'windows-1252')
//   .then(utils.parseSchedule)
//   .then(getAllBeneficiariesFromDb);
