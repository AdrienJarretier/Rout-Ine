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

        fs.readFile(fd, (encoding ? null : 'utf8'), (err, fileContent) => {

          fs.close(fd);

          if (err)
            reject(err);
          else {

            if (encoding) {

              let buf = iconv.decode(fileContent, encoding);

              let str = iconv.encode(buf, 'utf8');

              resolve(str);

            } else
              resolve(fileContent);

          }

        });

      }
    });
  });
}

function writeFile(file, content, append) {

  return new Promise((resolve, reject) => {

    fs.open(file, (append ? 'a' : 'w'), (err, fd) => {

      if (err) {

        reject(err);

      } else {

        fs.writeFile(fd, content, 'utf8', (err) => {

          if (err) {
            reject(err);
          } else {

            fs.close(fd);
            resolve();
          }

        });

      }
    });
  });

}

function writeJson(file, object) {

  return writeFile(file, JSON.stringify(object, null, 2));
}



/**
 * writes current date time in logfile then logs the given information
 *
 * @param {String} info information to write in logfile
 *
 */
function writeInLog(info) {

  let currentDate = new Date();

  let dateTimeString = currentDate.toLocaleDateString() + '_' + currentDate.toLocaleTimeString();

  let logFile = serverConfig.logs.dir + '/' + serverConfig.logs.errors;

  return writeFile(logFile, dateTimeString + ' : ' + info + '\n', true);
}
exports.writeInLog = writeInLog;


function logError(errorMsg) {

  const LOG_FILE = serverConfig.logs.dir + '/' + serverConfig.logs.errors;

  let currentDate = new Date();

  let dateTimeString = currentDate.toLocaleDateString() + '_' + currentDate.toLocaleTimeString();

  return writeFile(LOG_FILE, dateTimeString + ' : ' + errorMsg + '\n', true);
}
exports.logError = logError;



function logInfo(info) {

  const LOG_FILE = serverConfig.logs.dir + '/' + serverConfig.logs.infos;

  let currentDate = new Date();

  let dateTimeString = currentDate.toLocaleDateString() + '_' + currentDate.toLocaleTimeString();

  return writeFile(LOG_FILE, dateTimeString + ' : ' + info + '\n', true);
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

      console.log(realLogFiles);

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
