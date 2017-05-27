const csvParse = require('csv-parse');
const common = require('./common.js');



class Address {

  constructor(row) {

    this.label = row[1];
    this.town = row[3];

  }

}

class Beneficiary {

  constructor(row) {

    this.address = new Address(row);
    this.address_additional = row[2];
    this.phones = [row[4]];
    this.deliveries = [];

    this.addDelivery(row);

    this.note = row[6];

  }

  addDelivery(row) {

    this.deliveries.push(row[5]);

  }

}

class BeneficiariesList {

  constructor(parsedSchedule) {

    this.beneficiaries = {};

    for (let row of parsedSchedule) {

      let benef = this.beneficiaries[row[0]];

      if (benef)
        benef.addDelivery(row);
      else
        this.beneficiaries[row[0]] = new Beneficiary(row);

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

// this.export = parseSchedule;

common.readFile('exampleTours/tournées_CCAS_par_dateShort.csv', 'binary')
  .then(parseSchedule)
  .then((output) => {

    console.log(JSON.stringify(output, null, 2));

  });
