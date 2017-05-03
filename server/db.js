'use strict';
/*
Strict mode makes several changes to normal JavaScript semantics.
First, strict mode eliminates some JavaScript silent errors by changing them to throw errors.
Second, strict mode fixes mistakes that make it difficult for JavaScript engines to perform optimizations:
strict mode code can sometimes be made to run faster than identical code that's not strict mode.
Third, strict mode prohibits some syntax likely to be defined in future versions of ECMAScript.
*/

const fs = require('fs');
const mysql = require('mysql');

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// chargement de la classe AddressFeature
// AddressFeature.js est un module qui exporte la definition de la classe
const AddressFeature = require('./AddressFeature.js');
const FeatureCollection = require('./FeatureCollection.js');

/**
 * Retourne une promesse qui
 * lorsqu'elle est resolue retourne le tableau des adresses se trouvant dans la base de donnees
 * et ayant au moins 1 beneficiaire y habitant
 *
 * @returns {Promise} la promesse de retourner le tableau contenant les adresses.
 */
function getAddresses() {

  const sqlSelectAddresses = ' SELECT distinct a.id, a.label, a.town, a.lat, a.lng \n' +
    ' FROM address a \n' +
    ' RIGHT JOIN beneficiary ON a.id=beneficiary.address_id \n' +
    ' WHERE a.id IS NOT NULL;';

  return new Promise((resolve, reject) => {

    let dbCon = mysql.createConnection(config.db);
    dbCon.query(
      sqlSelectAddresses,
      (err, rows, fields) => {

        if (err) throw err

        dbCon.end();

        ccasAddress()
          .then((ccasAddress) => {

            rows.unshift(ccasAddress);

            resolve(rows);
          });

      });

  });

}

function getAddressesFromNames(names) {

  return new Promise((resolve, reject) => {

    const sql =
      ' SELECT distinct a.id, a.label, a.town, a.lat, a.lng \n' +
      ' FROM address a \n' +
      ' RIGHT JOIN beneficiary ON a.id=beneficiary.address_id \n' +
      ' WHERE a.id IS NOT NULL \n' +
      ' AND beneficiary.name like ?;';

    let queriesDone = 0;
    let notFound = 0;

    let addresses = [];

    console.log(names.length + ' beneficiaries');

    // la variable i est simplement utilisee pour garantir le maintient de lo'rdre initial des adresses
    // on utilise alors une variable 'offset' pour eviter les cases vides quand l'adresses est deja dans notre tableau
    let addressesOffset = 0;

    // on ouvre une connection pour faire une succession de requetes sur la liste de noms
    let dbCon = mysql.createConnection(config.db);
    for (let i in names) {

      let name = names[i];

      const select = mysql.format(sql, [name]);

      dbCon.query(
        select,
        (err, rows, fields) => {

          if (err) throw err

          if (rows.length == 0) {
            console.log('name not found : ' + name);
            ++notFound;
          } else if (notFound == 0) {

            let notInArray = true;

            for (let ad of addresses) {

              if (ad.id == rows[0].id) {

                // ad.addBeneficiary({
                //   name: rows[0].name,
                //   birthdate: rows[0].birthdate,
                //   address_additional: rows[0].address_additional
                // });

                notInArray = false;
                ++addressesOffset;
                break;
              }
            }

            if (notInArray) {
              addresses[i - addressesOffset] = rows[0];

              // addresses[i - addressesOffset].addBeneficiary({
              //   name: rows[0].name,
              //   birthdate: rows[0].birthdate,
              //   address_additional: rows[0].address_additional
              // });
            }
          }

          if (++queriesDone == names.length) {
            dbCon.end();

            if (notFound == 0)
              ccasAddress()
              .then((ccasAddress) => {

                addresses.unshift(ccasAddress);

                // addresses = new FeatureCollection(addresses);
                resolve(addresses);

              });
          }

        });

    }




  });

}

/**
 * Retourne une promesse qui est resolue avec l'adresse du ccas d'albi
 */
function ccasAddress() {

  const sqlSelectCcasAddress = ' SELECT distinct a.id, a.label, a.town, a.lat, a.lng, a.special \n' +
    ' FROM address a \n' +
    ' WHERE a.special = ?';

  const selectCcasAddress = mysql.format(sqlSelectCcasAddress, ["Centre Communal d'Action Sociale"]);

  return new Promise((resolve, reject) => {

    let dbCon = mysql.createConnection(config.db);
    dbCon.query(
      selectCcasAddress,
      (err, rows, fields) => {

        if (err) throw err

        dbCon.end();

        resolve(rows[0]);

      });

  });

}

/**
 * Retourne une promesse qui
 * lorsqu'elle est resolue retourne le tableau des beneficiaires
 * habitants a l'adresse donnee
 *
 * @returns {Promise} la promesse de retourner le tableau contenant les beneficiaires.
 */
function getBenefs(address, dbCon) {

  const sqlSelectBenef = ' SELECT id, name, birthdate, address_additional \n' +
    ' FROM beneficiary \n' +
    ' WHERE address_id = ?;';

  const selectBenef = mysql.format(sqlSelectBenef, [address.id]);

  return new Promise((resolve, reject) => {
    dbCon.query(
      selectBenef,
      (err, rows, fields) => {

        if (err) throw err

        let phonesRequests = 0;

        // si il n'y a aucun beneficiaire a cette adresses on renvoie la liste vide
        if (rows.length == 0) {
          resolve(rows);
        }

        // pour chaque beneficiaire on ajoute la liste de leurs num de telephone
        for (let benefRow of rows) {

          getPhones(benefRow, dbCon).then((phones) => {

            benefRow.phones = [];

            // on ajoute chaque numero a la list des numero du beneficiaire
            for (let phone of phones) {
              benefRow.phones.push(phone.phone_number)
            }

            if (++phonesRequests == rows.length)
              resolve(rows);

          });
        }

      });

  });

}



/**
 * Retourne une promesse qui
 * lorsqu'elle est resolue retourne le tableau des numero de telephone
 * d'un beneficiaire
 *
 * @returns {Promise} la promesse de retourner le tableau contenant les numeros de telephone.
 */
function getPhones(benefRow, dbCon) {

  const sqlSelectPhones = ' SELECT phone_number \n' +
    ' FROM beneficiary_phone \n' +
    ' WHERE beneficiary_id = ?;';

  const selectPhones = mysql.format(sqlSelectPhones, [benefRow.id]);

  return new Promise((resolve, reject) => {

    dbCon.query(
      selectPhones,
      (err, rows, fields) => {

        if (err) throw err

        resolve(rows);

      });

  });
}


getFullAddressesData(['BOUSQUET ALPHONSE', 'DUBECQ GUY'])
  .then((featColl) => {
    for (let feat of featColl.features)
      console.log(feat.properties.beneficiaries);
  });

/**
 * Retourne une promesse qui
 * lorsqu'elle est resolue retourne le GeoJson des adresses
 * avec les details beneficiares et numeros de telephone
 *
 * @param {Array} une liste de noms , si != undefined alors seules les adresses correspondantes a ces noms seront retournees
 *
 * @returns {Promise} la promesse de retourner une FeatureCollection de AddressFeature.
 */
function getFullAddressesData(namesList) {

  return new Promise((resolve, reject) => {

    // objet GeoJson
    let addresses = new FeatureCollection([]);

    let queriesDone = 0;

    let addressesFunction;

    if (namesList == undefined)
      addressesFunction = getAddresses;
    else
      addressesFunction = getAddressesFromNames;

    // Lorsque l'on obtient les adresses alors on va pour chaque adresse
    // recuperer les details des beneficiaires du portage de repas y habitant
    addressesFunction(namesList).then((rows) => {

      let dbCon = mysql.createConnection(config.db);

      let rowsLength = rows.length; // cette ligne est utilisee pour compter le nombre de requetes traitees
      // extremement utile puisque dans un fonctionnement asynchrone
      // impossible de savoir quelle sera la derniere requete traitee
      // console.log(rows);
      for (let address of rows) {

        let addrFeat = new AddressFeature(address);

        // console.log(address);

        // recuperons les beneficiares a cette adresse
        // quand on a la reponse alors on peut recuperer les numeros de telephone
        getBenefs(address, dbCon)
          .then((benefsRows) => {

            // console.log(benefsRows);

            addrFeat.addBeneficiaries(benefsRows);

            // console.log(addrFeat.properties.beneficiaries);

            addresses.push(addrFeat);

            // console.log(address);

            if (++queriesDone == rowsLength) {
              dbCon.end();
              resolve(addresses);
            }

            // on a les beneficiares on va alors recuperer les numeros de telephone
            // return getPhones(benefsRows, dbCon);
          });
        // // on a les numeros de telephones on peut alors terminer notre enchainement de .then()
        // // et si le compte est bon on resoud la promesse
        // //    sinon il reste des donnees a recuperer on ne fait rien
        // .then((phoneRows) => {

        //   addrFeat.addPhones(phoneRows);
        //   console.log(addrFeat.properties);

        //   addresses.push(addrFeat);

        //   // compter ici le nombre de requetes traitees
        //   // si on a tout traiter on peut remplir notre promesse avec le GeoJson
        //   if (++queriesDone == rowsLength) {
        //     dbCon.end();
        //     resolve(addresses);
        //   }
        // });

      }

    });
  });

}

exports.ccasAddress = ccasAddress;
exports.getAddresses = getAddresses;
exports.getFullAddressesData = getFullAddressesData;
