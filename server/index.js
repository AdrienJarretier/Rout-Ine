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

var app = express();
// The app object conventionally denotes the Express application

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// sert le contenu statique de ../client, c.a.d les pages web.
app.use(express.static(__dirname + '/../client'));


// repondre aux requetes get sur l'url /beneficiaries
app.get('/beneficiaries', function(req, res) {

  var connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'mysql',
    database: 'ccas_beneficiaries'
  });

  const sqlSelectAddresses = ' SELECT distinct a.id, a.label, a.town, a.additional, a.lat, a.lng \n' +
    ' FROM address a \n' +
    ' RIGHT JOIN beneficiary ON a.id=beneficiary.address_id ; ';

  const sqlSelectBenef = ' SELECT id, name, birthdate \n' +
    ' FROM beneficiary \n' +
    ' WHERE address_id = ?';

  console.log(sqlSelectAddresses);

  var addresses = {
    type: 'FeatureCollection',
    features: []
  };

  var queriesDone = 0;

  function feature(address) {
    var f = {

      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [address.lng, address.lat]
      },
      properties: {
        label: address.label,
        additional: address.additional,
        town: address.town
      },
      id: address.id
    };

    return f;
  }

  function featureAddBeneficiary(feat, ben) {

    feat.properties.beneficiaries = ben;

    return feat;
  }

  function addBenef(i, rowsLength) {

    return function(err, benefRows, fields) {

      if (err) throw err

      addresses.features[i] = featureAddBeneficiary(addresses.features[i], benefRows);

      if (++queriesDone == rowsLength)
        res.send(addresses);

    };

  }

  connection.query(
    sqlSelectAddresses,
    function(err, rows, fields) {

      if (err) throw err

      for (var i = 0; i < rows.length; ++i) {

        addresses.features.push(feature(rows[i]));

        const selectBenef = mysql.format(sqlSelectBenef, [rows[i].id]);

        connection.query(
          selectBenef,
          addBenef(i, rows.length));

      }
    });

});

app.listen(config.port, function() {
  console.log('listening on *:' + config.port);
});
