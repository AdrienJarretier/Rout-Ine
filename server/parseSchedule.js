const common = require('./common.js');
const csvParse = require('csv-parse');
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

function updateAddress(address) {

  console.log(address);

}

function updateBenef(benef, dbCon) {

  return new Promise((resolve, reject) => {

    const sqlSelectBenef = ' SELECT * \n' +
      ' FROM beneficiary \n' +
      ' WHERE name = ? ;';

    const sqlInsertBenef = ' INSERT INTO beneficiary(name, address_additional, address_id, note) \n' +
      ' VALUE(?,?,?,?) \n' +
      ' WHERE name = ? ;';

    const sqlUpdateBenef = ' SELECT * \n' +
      ' FROM beneficiary \n' +
      ' WHERE name = ? ;';

    updateAddress(benef.address);

    let selectBenef = mysql.format(sqlSelectBenef, [benef.name]);

    dbCon.query(
      selectBenef,
      (err, row, fields) => {

        if (err) throw err

        // si ce beneficiaire est nouveau on lance un insert
        if (row.length == 0) {

        }

        resolve(row);

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

common.readFile('exampleTours/tournées_CCAS_par_dateShort.csv', 'binary')
  .then(parseSchedule)
  .then(getAllBeneficiariesFromDb);
