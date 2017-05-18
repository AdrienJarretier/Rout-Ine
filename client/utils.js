(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.utils = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
function chunkify(array, nbChunks) {

  let chunkified = [];

  // let minChunkLength;

  let sliceStart = 0;

  let remainingElements = array.length;

  for (let i = 0; i < nbChunks; ++i) {

    let chunkSize = Math.floor(remainingElements / (nbChunks - i));
    let sliceEnd = sliceStart + chunkSize;

    chunkified.push(array.slice(sliceStart, sliceEnd));

    remainingElements -= chunkSize;

    sliceStart = sliceEnd;
  }

  return chunkified;

}
exports.chunkify = chunkify;

function randomColor() {
  var letters = '0123456789ABCDEF';
  var color = '#';
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}
exports.randomColor = randomColor;

function negateColor(htmlColorString) {

  let r = Number.parseInt(htmlColorString.slice(1, 3), 16);
  let g = Number.parseInt(htmlColorString.slice(3, 5), 16);
  let b = Number.parseInt(htmlColorString.slice(5, 7), 16);

  r = 255 - r;
  g = 255 - g;
  b = 255 - b;

  let nR = r.toString(16);
  let nG = g.toString(16);
  let nB = b.toString(16);

  return '#' + nR + nG + nB;

}
exports.negateColor = negateColor;

/**
 * Performs and return a deep copy of a 2 dimensional array
 */
function clone(matrix) {

  let mat = [];

  for (let i in matrix) {
    mat[i] = [];

    for (let j in matrix[i]) {
      mat[i][j] = Object.assign({}, matrix[i][j]);
    }
  }

  return mat;
}
exports.clone = clone;

/**
 * Calcule la distance entre les 2 coordonnees
 *
 * @param {Array} c1, 2 cases
 * @param {Array} c2, 2 cases
 *
 * @returns {Number} la distance entre les 2
 */
function distanceBetween(c1, c2) {

  let x = Math.abs(c2[0] - c1[0]);
  let y = Math.abs(c2[1] - c1[1]);

  return Math.sqrt(x * x + y * y);

}
exports.distanceBetween = distanceBetween;


function s2hours(seconds, appendSeconds) {

  let hours = Math.floor(seconds / 3600);
  let minutes = Math.floor(seconds % 3600) / 60;

  let textTime = hours + ' h ' + minutes + ' min';

  if (appendSeconds)
    textTime += ' ' + Math.floor(seconds) % 60 + ' s';


  return textTime;
}
exports.s2hours = s2hours;

},{}]},{},[1])(1)
});