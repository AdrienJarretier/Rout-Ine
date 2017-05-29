'use strict';
/*
Strict mode makes several changes to normal JavaScript semantics.
First, strict mode eliminates some JavaScript silent errors by changing them to throw errors.
Second, strict mode fixes mistakes that make it difficult for JavaScript engines to perform optimizations:
strict mode code can sometimes be made to run faster than identical code that's not strict mode.
Third, strict mode prohibits some syntax likely to be defined in future versions of ECMAScript.
*/

var bodyParser = require('body-parser');
const common = require('./common.js');
const express = require('express');
const mysql = require('mysql');
/*
  chargement des différents modules :
  - express (web framework)
  - fs : systeme de fichiers
  - mysql
*/
const db = require('./db.js');
const osrm = require('./osrm.js');
const ga2 = require('./ga2.js');
const testTournee = require('./testTournee.js');



let app = express();
// The app object conventionally denotes the Express application

app.set('views', __dirname + '/../client');
app.set('view engine', 'ejs');

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

const config = common.serverConfig;


app.get('/', function(req, res) {
  res.render('index');
})

app.get('/bestFromGa', function(req, res) {
  res.render('bestFromGa');
})

// sert le contenu statique de ../client, c.a.d les pages web.
app.use(express.static(__dirname + '/../client'));

// repondre aux requetes get sur l'url /beneficiaries
app.get('/beneficiaries', function(req, res) {

  db.getFullAddressesData().then((addressesGeoJson) => {
    res.send(addressesGeoJson);
  });

});


// repondre aux requetes get sur l'url /trip
app.get('/testTournee', function(req, res) {

  // quand la Promise retournee par getTrip est realisee
  // on peut envoyer le tableau de donnees au client{
  testTournee.getAll().then((trips) => {

    let promises = [];

    for (let i in trips) {

      promises.push(common.writeJson('tests/tourTrip' + i + '.json', trips[i].osrmTrip.trips[0]));

      // console.log(trips[i].addresses);

      for (let j in trips[i].osrmTrip.waypoints) {

        trips[i].addresses.features[j].setWaypointIndex(trips[i].osrmTrip.waypoints[j].waypoint_index);

      }

      promises.push(common.writeJson('tests/tourAddresses' + i + '.json', trips[i].addresses));

    }

    Promise.all(promises)
      .then(() => {

        console.log('sending trips to client');
        res.send(trips);
      });

  });
});

app.get('/listResults', function(req, res) {

  common.getResultsDates()
    .then((dates) => {

      res.send(dates);

    });

});

app.post('/bestFromGa', function(req, res) {

  let date = req.body

  console.log(date);

  const RESULT_FILE = 'bestTours' + date.date + '_' + date.time + '.json';

  common.readFile(config.resultsFolder + '/' + RESULT_FILE)
    .then((fileContent) => {

        res.send(JSON.parse(fileContent));
      },
      (err) => {

        if (err.code == 'ENOENT') {

          const logMsg = 'impossible de trouver le fichier ' + RESULT_FILE;

          console.log(logMsg);
          common.writeInLog(logMsg)
            .then(() => {

              res.send(err);

            });

        } else {

          console.log(err);
          common.writeInLog(err.Error)
            .then(() => {

              res.send(err);

            });

        }

      });

});


let server = require('http').Server(app);
let io = require('socket.io')(server);

// le serveur attend les connexions sur le port 'config.port'
server.listen(config.port, function() {
  console.log('listening on *:' + config.port);
});

io.on('connection', function(socket) {

  socket.on('start', function(params) {

    ga2.start(params, socket);

  });

  socket.on('stop', function() {

    console.log('stopping ga');

    ga2.stop();

  });

  socket.on('disconnect', function() {
    console.log('disconnected');
  });
});

function sendTour(req, res, baseFileName) {

  let options = {
    root: __dirname + '/' + common.serverConfig.resultsFolder
  };

  res.sendFile(baseFileName + req.query.num + '.json', options);

}

app.get('/downloadAddresses', function(req, res) {

  sendTour(req, res, 'tourAddresses');

});


app.get('/downloadTrip', function(req, res) {

  sendTour(req, res, 'tourTrip');

});
