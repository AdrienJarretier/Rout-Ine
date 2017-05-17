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
const ga = require('./ga.js');
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
app.get('/trip', function(req, res) {

  // quand la Promise retournee par getTrip est realisee
  // on peut envoyer le tableau de donnees au client{
  ga.getTrips(req.query.nbTrips).then((trips) => {

    console.log('sending trips to client');
    res.send(trips);

  });
});


// repondre aux requetes get sur l'url /trip
app.get('/simuData', function(req, res) {

  // quand la Promise retournee par getTrip est realisee
  // on peut envoyer le tableau de donnees au client{
  ga.getTrips(2).then((trips) => {

    console.log('sending trips to client');
    res.send(trips);

  });
});


// repondre aux requetes get sur l'url /trip
app.get('/testTournee', function(req, res) {

  // quand la Promise retournee par getTrip est realisee
  // on peut envoyer le tableau de donnees au client{
  testTournee.getAll().then((trips) => {

    let promises = [];

    for (let i in trips) {

      promises.push(common.writeJson('tourTrip' + i + '.json', trips[i].osrmTrip.trips[0]));
      promises.push(common.writeJson('tourAddresses' + i + '.json', trips[i].addresses));

    }

    Promise.all(promises)
      .then(() => {

        console.log('sending trips to client');
        res.send(trips);
      });

  });
});

app.get('/bestFromGa', function(req, res) {

  common.readFile('bestTours.json')
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
  socket.emit('news', { hello: 'world' });
  socket.on('my other event', function(data) {
    console.log(data);
  });
});
