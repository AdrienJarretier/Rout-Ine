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
var multer = require('multer');
const mysql = require('mysql');
const session = require('express-session');
/*
  chargement des différents modules :
  - express (web framework)
  - fs : systeme de fichiers
  - mysql
*/

const BYPASS_AUTHENTICATION = !common.serverConfig.requireLdapAuth;


const db = require('./db.js');
const osrm = require('./osrm.js');
const ga2 = require('./ga2.js');
const manageTours = require('./manageTours.js');
const parseSchedule = require('./parseSchedule.js');
const utils = require('./utils.js');

let passport, LdapStrategy;

if (!BYPASS_AUTHENTICATION) {

  passport = require('passport');
  LdapStrategy = require('passport-ldapauth');

  passport.use('ldap', new LdapStrategy(common.LdapStrategy_OPTS.ldap,
    function(user, done) {

      console.log('valid');
      return done(null, user);

    }
  ));

  passport.use('ad', new LdapStrategy(common.LdapStrategy_OPTS.ad,
    function(user, done) {

      let memberOfAuthorizedGroup = false;

      for (let g of user.memberOf) {

        if (g.match(/.*GG_LOG_78010_USER.*/i))
          memberOfAuthorizedGroup = true;

      }

      if (memberOfAuthorizedGroup)
        return done(null, user);
      else
        return done(null, false, { message: 'Vous n\'êtes pas dans un groupe autorisé à utiliser Rout-Ine.' });

    }
  ));

}


var upload = multer({ dest: 'uploads/' });

let app = express();
// The app object conventionally denotes the Express application

app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}))

if (!BYPASS_AUTHENTICATION) {

  app.use(passport.initialize());

  app.use(passport.session());

  passport.serializeUser(function(user, done) {
    done(null, user.name);
  });

  passport.deserializeUser(function(name, done) {
    done(null, name);
  });

}

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.set('views', __dirname + '/../client');
app.set('view engine', 'ejs');


const config = common.serverConfig;


// app.get('/login', function(req, res) {

//   console.log('req.originalUrl');
//   console.log(req.originalUrl);

//   res.render('login');
// });

if (!BYPASS_AUTHENTICATION)
  app.post('/validateLogin', passport.authenticate('ad', { session: true }), function(req, res) {

    res.redirect('/');
  });





/**
 *
 * @param {Integer} fileNum le numero du fichier, 0 pour route, 1 pour adresses
 */
function sendTour(req, res, fileNum) {

  let options = {
    root: __dirname
  };

  let now = new Date();


  if (req.query.deliveryYear)
    now.setFullYear(req.query.deliveryYear);

  if (req.query.deliveryMonth)
    now.setMonth(req.query.deliveryMonth);

  if (req.query.deliveryDay)
    now.setDate(req.query.deliveryDay);

  let dateString = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();

  let num;

  if (req.method == 'POST')
    num = req.body.num;
  else
    num = req.query.num;

  manageTours.getTourByQueryNum(num, dateString)
    .then((files) => {

      res.sendFile(files[fileNum], options);

    });

}

function saveTabletLogs(req, res) {

  common.readFile(req.file.path)
    .then((msg) => {


      let logFile = common.serverConfig.logs.dir + '/' + common.serverConfig.logs.tablets;

      common.readFile(logFile)
        .then((content) => {

            return JSON.parse(content);

          },
          (err) => {

            return {};

          })
        .then((logObject) => {

          Object.assign(logObject, JSON.parse(msg));

          return common.writeJson(logFile, logObject);

        })
        .then(res.send('ok'))

    });

}

function sendNumberOfTours(req, res) {

  db.getNumberOfTours()
    .then((numberOfTours) => {

      res.send({ numberOfTours: numberOfTours });

    });

}

function authenticateIfRequired(req, res, next) {

  if (!BYPASS_AUTHENTICATION)
    passport.authenticate('ldap', { session: false })(req, res, next);
  else
    next();

}



app.post('/downloadAddresses', authenticateIfRequired, function(req, res) {

  sendTour(req, res, 1);

});

app.post('/downloadTrip', authenticateIfRequired, function(req, res) {

  sendTour(req, res, 0);

});

app.post('/tabletLogsUpload', upload.single('file'), authenticateIfRequired, saveTabletLogs);

app.post('/getNumberOfTours', authenticateIfRequired, sendNumberOfTours);


app.use(express.static(__dirname + '/../client/statics/notSecure'));
app.use(express.static(__dirname + '/../client/statics/notSecure/extLibs'));


app.all('*', function(req, res, next) {

  let accessInfos = {

    ip: req.ip,
    method: req.method,
    path: req.path,
    query: req.query

  };

  if (!BYPASS_AUTHENTICATION)
    accessInfos.authorized = (req.session.passport && req.session.passport.user ? true + ' (' +
      req.session.passport.user + ')' : false);
  else
    accessInfos.authorized = 'authentication disabled';

  common.log('access', accessInfos, 1)
    .then(() => {

      if ((req.session.passport && req.session.passport.user) || BYPASS_AUTHENTICATION)
        next();
      else
        res.render('login');

    });
});


// sert le contenu statique de ../client, c.a.d les pages web.
app.use(express.static(__dirname + '/../client/statics'));


app.get('/', function(req, res) {
  res.render('manageTours');
})

app.get('/manageTours', function(req, res) {
  res.render('manageTours');
})

app.get('/tourComputing', function(req, res) {
  res.render('tourComputing');
})

app.get('/uploadPlanning', function(req, res) {
  res.render('uploadPlanning');
})

app.get('/tabletsLogs', function(req, res) {
  res.render('tabletsLogs');
})




// repondre aux requetes get sur l'url /beneficiaries
app.get('/beneficiaries', function(req, res) {

  db.getFullAddressesData().then((addressesGeoJson) => {
    res.send(addressesGeoJson);
  });

});

app.get('/listResults', function(req, res) {

  db.getAllDeliveriesDates()
    .then((dates) => {

      res.send(dates);

    });

});

app.post('/bestFromGa', function(req, res) {

  let date = req.body


  const RESULT_FILE = 'bestTours' + date.date + '_' + date.time + '.json';

  common.readFile(config.resultsFolder + '/' + RESULT_FILE)
    .then((fileContent) => {

        res.send(JSON.parse(fileContent));
      },
      (err) => {

        if (err.code == 'ENOENT') {

          const logMsg = 'impossible de trouver le fichier ' + RESULT_FILE;

          common.writeInLog(logMsg)
            .then(() => {

              res.send(err);

            });

        } else {

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

  console.log('listening on *:' + common.serverConfig.port);

});

let schedulePath;

io.on('connection', function(socket) {


  socket.on('parseSchedule', function() {

    common.readFile(schedulePath, 'windows-1252')
      .then(utils.parseSchedule)
      .then((beneficiariesList) => {
        return parseSchedule.updateBeneficiariesFromScheduleList(beneficiariesList, socket);
      });

  });


  socket.on('start', function(params) {

    ga2.start(params, socket);

  });

  socket.on('stop', function() {


    ga2.stop();

  });

  socket.on('disconnect', function() {});
});


app.get('/getNumberOfTours', sendNumberOfTours);

app.get('/downloadAddresses', function(req, res) {

  sendTour(req, res, 1);

});


app.get('/downloadTrip', function(req, res) {

  sendTour(req, res, 0);

});



app.post('/scheduleUpload', upload.single('inputSchedule'), function(req, res, next) {

  schedulePath = req.file.path;

  res.send('ok');

});

app.get('/logs', function(req, res) {

  common.getLogsList()
    .then((list) => {

      let promisesReadLogs = [];

      for (let logFile of list) {

        let logPath = common.serverConfig.logs.dir + '/' + logFile;

        promisesReadLogs.push(common.readFile(logPath));

      }

      Promise.all(promisesReadLogs)
        .then((logsContents) => {

          let logs = {};

          for (let i in list) {

            let logFile = list[i];

            logs[logFile] = JSON.parse(logsContents[i]);

          }

          res.send(logs);

        }, (e) => {


        });

    });

});
