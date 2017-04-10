'use strict';
/*
Strict mode makes several changes to normal JavaScript semantics.
First, strict mode eliminates some JavaScript silent errors by changing them to throw errors.
Second, strict mode fixes mistakes that make it difficult for JavaScript engines to perform optimizations:
strict mode code can sometimes be made to run faster than identical code that's not strict mode.
Third, strict mode prohibits some syntax likely to be defined in future versions of ECMAScript.
*/

const express = require('express');
const fs = require('fs');
const mysql = require('mysql');
/*
  chargement des différents modules :
  - express (web framework)
  - fs : systeme de fichiers
  - mysql
*/

// chargement de la classe AddressFeature
// AddressFeature.js est un module qui exporte la defenition de la classe
const AddressFeature = require('./AddressFeature.js');

const osrm = require('./osrm.js');

var app = express();
// The app object conventionally denotes the Express application

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// sert le contenu statique de ../client, c.a.d les pages web.
app.use(express.static(__dirname + '/../client'));


// repondre aux requetes get sur l'url /beneficiaries
app.get('/beneficiaries', function(req, res) {

  var connection = mysql.createConnection(config.db);

  const sqlSelectAddresses = ' SELECT distinct a.id, a.label, a.town, a.additional, a.lat, a.lng \n' +
    ' FROM address a \n' +
    ' RIGHT JOIN beneficiary ON a.id=beneficiary.address_id ; ';

  const sqlSelectBenef = ' SELECT id, name, birthdate \n' +
    ' FROM beneficiary \n' +
    ' WHERE address_id = ?';

  const sqlSelectPhones = ' SELECT DISTINCT phone_number \n' +
    ' FROM beneficiary_phone \n' +
    ' WHERE beneficiary_id IN (?)';

  console.log(sqlSelectAddresses);

  var addresses = {
    type: 'FeatureCollection',
    features: []
  };

  var queriesDone = 0;

  function addBenef(i, rowsLength) {

    return function(err, benefRows, fields) {

      if (err) throw err

      addresses.features[i].addBeneficiaries(benefRows);

      // recuperons la liste des ids beneficiaires
      let ids = '';
      for (let b of benefRows) {
        ids += b.id + ',';
      }
      ids = ids.slice(0, -1);
      // enlever la dernire virgule

      const selectPhones = mysql.format(sqlSelectPhones, [ids]);

      connection.query(
        selectPhones,
        addPhones(i, rowsLength));

    };

  }

  function addPhones(i, rowsLength) {

    return function(err, phonesRows, fields) {

      if (err) throw err

      addresses.features[i].addPhones(phonesRows);

      if (++queriesDone == rowsLength)
        res.send(addresses);

    };

  }

  connection.query(
    sqlSelectAddresses,
    function(err, rows, fields) {

      if (err) throw err

      for (var i = 0; i < rows.length; ++i) {

        addresses.features.push(new AddressFeature(rows[i]));

        const selectBenef = mysql.format(sqlSelectBenef, [rows[i].id]);

        connection.query(
          selectBenef,
          addBenef(i, rows.length));

      }
    });

});


// repondre aux requetes get sur l'url /trip
app.get('/trip', function(req, res) {

  // quand la Promise retournee par getTrip est realisee
  // on peut envoyer le tableau de donnees au client
  osrm.getTrip().then((tripArray) => {

    res.send(tripArray);

  });
});

// le serveur attend les connexions sur le port 'config.port'
app.listen(config.port, function() {
  console.log('listening on *:' + config.port);
});
