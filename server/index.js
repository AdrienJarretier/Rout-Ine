'use strict';
/*
Strict mode makes several changes to normal JavaScript semantics.
First, strict mode eliminates some JavaScript silent errors by changing them to throw errors.
Second, strict mode fixes mistakes that make it difficult for JavaScript engines to perform optimizations:
strict mode code can sometimes be made to run faster than identical code that's not strict mode.
Third, strict mode prohibits some syntax likely to be defined in future versions of ECMAScript.
*/

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

const config = common.serverConfig;

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

app.get('/bestFromGa', function(req, res) {

  common.readFile(config.resultsFolder + '/bestTours.json')
    .then((fileContent) => {

      res.send(JSON.parse(fileContent));
    });

});


let server = require('http').Server(app);
let io = require('socket.io')(server);

// le serveur attend les connexions sur le port 'config.port'
server.listen(config.port, function() {
  console.log('listening on *:' + config.port);
});

io.on('connection', function(socket) {

  socket.on('start', function() {

    console.log('starting ga');

    ga2.start(2, socket);

  });

  socket.on('stop', function() {

    console.log('stopping ga');

    ga2.stop();

  });

  socket.on('disconnect', function() {
    console.log('disconnected');
  });
});
