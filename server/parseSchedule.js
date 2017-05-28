const common = require('./common.js');
const csvParse = require('csv-parse');
const geocode = require('./geocode.js');
const mysql = require('mysql');

class Address {

  constructor(parsedLine) {

    this.label = parsedLine[1].replace(/^\s*0\s*,\s*/g, '');
    this.town = parsedLine[3];

  }

}

class Beneficiary {

  constructor(parsedLine) {

    this.name = parsedLine[0];
    this.address = new Address(parsedLine);
    this.address_additional = parsedLine[2];
    this.phones = [parsedLine[4]];
    this.deliveries = [];

    this.addDelivery(parsedLine);

    this.note = parsedLine[6];

  }

  addDelivery(parsedLine) {

    this.deliveries.push(parsedLine[5]);

  }

}

class BeneficiariesList {

  constructor(parsedSchedule) {

    this.beneficiaries = {};

    for (let parsedLine of parsedSchedule) {

      let benef = this.beneficiaries[parsedLine[0]];

      if (benef)
        benef.addDelivery(parsedLine);
      else
        this.beneficiaries[parsedLine[0]] = new Beneficiary(parsedLine);

    }

  }

}

function parseSchedule(schedule) {

  return new Promise((resolve, reject) => {

    let options = {
      delimiter: ";",
      from: 2
    }

    csvParse(schedule, options, function(err, output) {

      resolve(new BeneficiariesList(output));

    });

  });
}

function dbQuery(statement, dbCon) {

  return new Promise((resolve, reject) => {

    dbCon.query(statement, function(error, result, fields) {

      if (error) throw error;

      resolve(result);

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

              const insertAddress = mysql.format(sqlInsertAddress, [address.label, address.town, coords.lat, coords.lng]);

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

              const sqlInsertBenef = ' INSERT INTO beneficiary(name, address_additional, address_id, note) \n' +
                ' VALUES(?,?,?,?) ; ';

              const insertBenef = mysql.format(sqlInsertBenef, [benef.name, benef.address_additional, addressId, benef.note]);

              return dbQuery(insertBenef, dbCon)
                .then((result) => {

                  return result.insertId;

                });

            } else {

              const sqlUpdateBenef = ' UPDATE beneficiary \n' +
                ' SET address_additional = ?, note = ? \n' +
                ' WHERE id = ? ; ';

              const updateBenef = mysql.format(sqlUpdateBenef, [benef.address_additional, benef.note, rows[0].id]);

              return dbQuery(updateBenef, dbCon)
                .then(() => {

                  return rows[0].id;

                });
            }

          })
          .then((benefId) => {

            resolve(updatePhones(benefId, benef.phones, dbCon));

          });

      });

  });

}

function getAllBeneficiariesFromDb(beneficiariesList) {

  let dbCon = mysql.createConnection(common.serverConfig.db);

  let promises = [];

  for (let name in beneficiariesList.beneficiaries) {

    let benef = beneficiariesList.beneficiaries[name];

    promises.push(updateBenef(benef, dbCon));

  }

  Promise.all(promises)
    .then((values) => {

      dbCon.end();

    });

}

common.readFile('exampleTours/tournées_CCAS_par_dateShort.csv', 'windows-1252')
  .then(parseSchedule)
  .then(getAllBeneficiariesFromDb);
