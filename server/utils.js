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
