const csvParse = require('csv-parse');
const common = require('./common.js');

common.readFile('exampleTours/tournées_CCAS_par_dateShort.csv', 'binary')
  .then((fileContent) => {

    let options = {
      delimiter: ";",
      from: 2
    }

    csvParse(fileContent, options, function(err, output) {

      console.log(output);

    });

  });
