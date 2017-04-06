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

  connection.connect();

  const query = ' SELECT distinct a.label, a.additional, a.lat, a.lng \n' +
                ' FROM address a \n' +
                ' RIGHT JOIN beneficiary ON a.id=beneficiary.address_id ; ';

  console.log(query);

  connection.query(
    query,
    function(err, rows, fields) {

      if (err) throw err

      res.send(rows);

    });

  connection.end();

});


// app.get('/patinoires', function(req, res) {

//     var db = new sqlite3.Database(DATABASE_NAME);

//     db.serialize(function() {

//         db.all("SELECT * FROM patinoires", function(err, rows) {

//             for (var i = 0; i < rows.length; ++i) {
//                 rows[i].coordinates = [rows[i].lng, rows[i].lat];

//                 delete rows[i].lng;
//                 delete rows[i].lat;
//             }
//             console.log(rows);
//             res.send(rows);
//         });

//     });

//     db.close();
// });

// app.get('/boulodromes', function(req, res) {

//     var db = new sqlite3.Database(DATABASE_NAME);

//     db.serialize(function() {

//         db.all("SELECT * FROM boulodromes", function(err, rows) {

//             for (var i = 0; i < rows.length; ++i) {
//                 rows[i].coordinates = [rows[i].lng, rows[i].lat];

//                 delete rows[i].lng;
//                 delete rows[i].lat;
//             }
//             res.send(rows);
//         });

//     });

//     db.close();
// });

app.listen(config.port, function() {
  console.log('listening on *:' + config.port);
});
