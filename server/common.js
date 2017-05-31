'use strict';
/*
Strict mode makes several changes to normal JavaScript semantics.
First, strict mode eliminates some JavaScript silent errors by changing them to throw errors.
Second, strict mode fixes mistakes that make it difficult for JavaScript engines to perform optimizations:
strict mode code can sometimes be made to run faster than identical code that's not strict mode.
Third, strict mode prohibits some syntax likely to be defined in future versions of ECMAScript.
*/

let Random = require("random-js");
let mt = Random.engines.mt19937().autoSeed();

exports.Random = Random;
exports.mt = mt;

const fs = require('fs');
var iconv = require('iconv-lite');

const serverConfig = JSON.parse(fs.readFileSync('config.json', 'utf8'));

function readFile(file, encoding) {

  return new Promise((resolve, reject) => {

    fs.open(file, 'r', (err, fd) => {

      if (err) {

        reject(err);

      } else {

        let fileContent = fs.readFileSync(fd, (encoding ? null : 'utf8'));
        fs.close(fd);

        if (encoding) {

          let buf = iconv.decode(fileContent, encoding);

          let str = iconv.encode(buf, 'utf8');

          resolve(str);

        } else
          resolve(fileContent);

      }
    });
  });
}

function writeFile(file, content, append) {

  return new Promise((resolve, reject) => {

    let fd = fs.openSync(file, (append ? 'a' : 'w'));

    fs.writeFileSync(fd, content);
    console.log('written');
    fs.close(fd);
    resolve();

  });

}

function writeJson(file, object) {

  return writeFile(file, JSON.stringify(object, null, 1));
}


/**
 * writes current date time in logfile then logs the given information
 *
 * @param {String} type The type of log, see config.json logs
 * @param {Object} object with custom informations to write, stringified before writing
 *
 */
function log(type, msgObject) {

  let logFile = serverConfig.logs.dir + '/' + serverConfig.logs[type];

  return readFile(logFile)
    .then((content) => {

        return JSON.parse(content);

      },
      (err) => {

        return {};

      })
    .then((logObject) => {

      let currentDate = new Date();

      let dateTimeString = currentDate.toLocaleDateString() + '_' + currentDate.toLocaleTimeString() + '.' + currentDate.getMilliseconds();

      logObject[dateTimeString] = msgObject;

      return writeJson(logFile, logObject);

    });

}
exports.log = log;


function writeInLog(info) {

  return log('errors', info);
}
exports.writeInLog = writeInLog;


function logError(errorMsg) {

  return log('errors', info);
}
exports.logError = logError;



function logInfo(info) {

  return log('infos', info);
}
exports.logInfo = logInfo;



function getLogsList() {

  return new Promise((resolve, reject) => {

    fs.readdir(serverConfig.logs.dir, (err, files) => {

      if (err) throw err;

      let logKeys = Object.keys(serverConfig.logs);

      let realLogFiles = [];

      for (let k of logKeys) {

        if (files.indexOf(serverConfig.logs[k]) != -1)
          realLogFiles.push(serverConfig.logs[k]);

      }

      resolve(realLogFiles);

    });

  });

}
exports.getLogsList = getLogsList;

function getResultsDates() {

  return new Promise((resolve, reject) => {

    fs.readdir('gaResults', (err, files) => {

      if (err) throw err;

      const BASE_NAME = 'bestTours';
      const EXT = '.json';

      let dateTimes = [];

      for (let file of files) {

        if (file.startsWith(BASE_NAME)) {

          let resultDateTime = file.slice(BASE_NAME.length, file.length - EXT.length);

          let resultDate = resultDateTime.replace(/_.*/g, '');
          let resultTime = resultDateTime.replace(/.*_/g, '');

          let dateTime = {
            date: resultDate,
            time: resultTime
          }

          dateTimes.push(dateTime);
        }

      }

      resolve(dateTimes);

    });

  });
}
exports.getResultsDates = getResultsDates;

exports.readFile = readFile;
exports.serverConfig = serverConfig;
exports.writeFile = writeFile;
exports.writeJson = writeJson;
