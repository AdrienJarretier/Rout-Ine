const common = require('./common.js');
const csvParse = require('csv-parse');
const geocode = require('./geocode.js');
const mysql = require('mysql');

class Address {

  constructor(parsedLine) {

    this.label = parsedLine[1];
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

let dbCon = mysql.createConnection(common.serverConfig.db);

updateAddress({ label: 'test5dd6', town: 'testAlbi' }, dbCon)
  .then((id) => {

    dbCon.end();
    console.log(id);

  });

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

function updateBenef(benef, dbCon) {

  return new Promise((resolve, reject) => {

    updateAddress(benef.address, dbCon)
      .then((addressId) => {

        const sqlSelectBenef = ' SELECT * \n' +
          ' FROM beneficiary \n' +
          ' WHERE name = ? AND address_id = ? ; ';

        const selectBenef = mysql.format(sqlSelectBenef, [benef.name, addressId]);

        dbCon.query(
          selectBenef,
          (err, row, fields) => {

            if (err) throw err

            let benefId;

            // si ce beneficiaire est nouveau on lance un insert
            if (row.length == 0) {

              const sqlInsertBenef = ' INSERT INTO beneficiary(name, address_additional, address_id, note) \n' +
                ' VALUES(?,?,?,?) ; ';

              const insertBenef = mysql.format(sqlInsertBenef, [benef.name, benef.address_additional, addressId, benef.note]);

              dbCon.query(insertBenef, function(error, result, fields) {

                if (error) throw error;

                console.log('inserted');
                console.log(result);

                resolve(result.insertId);

              });

            } else {

              console.log(row);

              // benefId = row[]

              const sqlUpdateBenef = ' UPDATE beneficiary \n' +
                ' SET address_additional = ?, note = ? \n' +
                ' WHERE name = ? AND address_id = ? ; ';

              const updateBenef = mysql.format(sqlInsertBenef, [benef.address_additional, benef.note, benef.name, addressId]);
            }

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

      console.log(values);
      dbCon.end();

    });

}

// common.readFile('exampleTours/tournées_CCAS_par_dateShort.csv', 'windows-1252')
//   .then(parseSchedule)
//   .then((list) => {
//     console.log(JSON.stringify(list, null, 2));
//   })
// .then(getAllBeneficiariesFromDb)
;
