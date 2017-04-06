const express = require('express');
// charge le module express (web framework)
const fs = require('fs');
// charge le module de systeme de fichiers

var app = express();
// The app object conventionally denotes the Express application

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// sert le contenu statique de ../client, c.a.d les pages web.
app.use(express.static(__dirname + '/../client'));




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
