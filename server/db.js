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

/**
 * Retourne une promesse qui
 * lorsqu'elle est resolue retourne le tableau des adresses se trouvant dans la base de donnees
 * et ayant au moins 1 beneficiaire y habitant
 *
 * @returns {Promise} la promesse de retourner le tableau contenant les adresses.
 */
function getAddresses() {

  const sqlSelectAddresses = ' SELECT distinct a.id, a.label, a.town, a.additional, a.lat, a.lng \n' +
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

/**
 * Retourne une promesse qui est resolue avec l'adresse du ccas d'albi
 */
function ccasAddress() {

  const sqlSelectCcasAddress = ' SELECT distinct a.id, a.label, a.town, a.additional, a.lat, a.lng \n' +
    ' FROM address a \n' +
    ' WHERE a.additional = ?';

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

getAddresses();


/**
 * Retourne une promesse qui
 * lorsqu'elle est resolue retourne le tableau des beneficiaires
 * habitants a l'adresse donnee
 *
 * @returns {Promise} la promesse de retourner le tableau contenant les beneficiaires.
 */
function getBenefs(address, dbCon) {


  const sqlSelectBenef = ' SELECT id, name, birthdate \n' +
    ' FROM beneficiary \n' +
    ' WHERE address_id = ?';

  const selectBenef = mysql.format(sqlSelectBenef, [address.id]);

  return new Promise((resolve, reject) => {

    dbCon.query(
      selectBenef,
      (err, rows, fields) => {

        if (err) throw err

        resolve(rows);

      });

  });

}


/**
 * Retourne une promesse qui
 * lorsqu'elle est resolue retourne le tableau des numero de telephone
 * d'un groupe de beneficiaires
 *
 * @returns {Promise} la promesse de retourner le tableau contenant les numeros de telephone.
 */
function getPhones(benefRows, dbCon) {

  const sqlSelectPhones = ' SELECT DISTINCT phone_number \n' +
    ' FROM beneficiary_phone \n' +
    ' WHERE beneficiary_id IN (?)';

  // recuperons la liste des ids beneficiaires
  let ids = '';
  for (let b of benefRows) {
    ids += b.id + ',';
  }
  ids = ids.slice(0, -1);
  // enlever la dernire virgule

  const selectPhones = mysql.format(sqlSelectPhones, [ids]);

  return new Promise((resolve, reject) => {

    dbCon.query(
      selectPhones,
      (err, rows, fields) => {

        if (err) throw err

        resolve(rows);

      });

  });
}

/**
 * Retourne une promesse qui
 * lorsqu'elle est resolue retourne le GeoJson des adresses
 * avec les details beneficiares et numeros de telephone
 *
 * @returns {Promise} la promesse de retourner le tableau contenant les numeros de telephone.
 */
function getFullAddressesData() {

  return new Promise((resolve, reject) => {

    // objet GeoJson
    let addresses = {
      type: 'FeatureCollection',
      features: []
    };

    let queriesDone = 0;

    // Lorsque l'on obtient les adresses alors on va pour chaque adresse
    // recuperer les details des beneficiaires du portage de repas y habitant
    getAddresses().then((rows) => {

      let dbCon = mysql.createConnection(config.db);

      let rowsLength = rows.length; // cette ligne est utilisee pour compter le nombre de requetes traitees
      // extremement utile puisque dans un fonctionnement asynchrone
      // impossible de savoir quelle sera la derniere requete traitee
      for (let address of rows) {

        let addrFeat = new AddressFeature(address);


        // recuperons les beneficiares a cette adresse
        // quand on a la reponse alors on peut recuperer les numeros de telephone
        getBenefs(address, dbCon).then((benefsRows) => {

            addrFeat.addBeneficiaries(benefsRows);

            // on a les beneficiares on va alors recuperer les numeros de telephone
            return getPhones(benefsRows, dbCon);
          })
          // on a les numeros de telephones on peut alors terminer notre enchainement de .then()
          // et si le compte est bon on resoud la promesse
          //    sinon il reste des donnees a recuperer on ne fait rien
          .then((phoneRows) => {

            addrFeat.addPhones(phoneRows);

            addresses.features.push(addrFeat);

            // compter ici le nombre de requetes traitees
            // si on a tout traiter on peut remplir notre promesse avec le GeoJson
            if (++queriesDone == rowsLength) {
              dbCon.end();
              resolve(addresses);
            }
          });

      }

    });
  });

}

exports.getAddresses = getAddresses;
exports.getFullAddressesData = getFullAddressesData;
