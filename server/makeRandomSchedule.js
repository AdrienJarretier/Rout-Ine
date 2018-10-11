const common = require('./common.js');
const db = require('./db.js');


db.getFullAddressesData()
    .then((rows) => {

        // console.log(rows);

        let output = '';

        common.Random.shuffle(common.mt, rows.features);

        for (let j = 0; j < 60; ++j) {

            let picked = rows.features[j].properties;

            for (let b of picked.beneficiaries) {

                let scheduleParts = [];
                scheduleParts.push(b.name);
                scheduleParts.push((b.birthdate ? b.birthdate.getDate() + '/' + (parseInt(b.birthdate.getMonth()) + 1) + '/' + b.birthdate.getYear() : ''));
                scheduleParts.push(picked.label);
                scheduleParts.push((b.address_additional != ' ' ? b.address_additional : ''));
                scheduleParts.push(picked.town);

                for (let i = 0; i < 2; ++i) {

                    scheduleParts.push((b.phones[i] ? b.phones[i] : ''));

                }

                scheduleParts.push('10/11/18');
                scheduleParts.push(b.diet);
                scheduleParts.push((b.note != ' ' ? b.note : ''));

                let line = '';

                for (let part of scheduleParts) {

                    line += part + ';';

                }

                line = line.replace(/\n/g, '');



                output += line.slice(0, -1) + '\n';

            }

        }



        common.writeFile('randomSchedule.csv', output).
        then(() => {

            console.log('output to randomSchedule.csv');

        });


    });