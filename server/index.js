const sqlite3 = require('sqlite3').verbose();
const express = require('express');
var app = express();

const config = { port: 9226 };

app.use(express.static(__dirname + '/../client'));


app.get('/', function(req, res) {
    res.sendfile('index.html');
});

const DATABASE_NAME = 'geoData.db';

app.get('/patinoires', function(req, res) {

    var db = new sqlite3.Database(DATABASE_NAME);

    db.serialize(function() {

        db.all("SELECT * FROM patinoires", function(err, rows) {

            for (var i = 0; i < rows.length; ++i) {
                rows[i].coordinates = [rows[i].lng, rows[i].lat];

                delete rows[i].lng;
                delete rows[i].lat;
            }
            console.log(rows);
            res.send(rows);
        });

    });

    db.close();
});

app.get('/boulodromes', function(req, res) {

    var db = new sqlite3.Database(DATABASE_NAME);

    db.serialize(function() {

        db.all("SELECT * FROM boulodromes", function(err, rows) {

            for (var i = 0; i < rows.length; ++i) {
                rows[i].coordinates = [rows[i].lng, rows[i].lat];

                delete rows[i].lng;
                delete rows[i].lat;
            }
            res.send(rows);
        });

    });

    db.close();
});

app.listen(config.port, function() {
    console.log('listening on *:' + config.port);
});