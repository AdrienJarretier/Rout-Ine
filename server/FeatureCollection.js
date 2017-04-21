class FeatureCollection {
  constructor(featuresArray) {
    this.type = 'FeatureCollection';
    this.features = featuresArray;
  }

  push(feature) {
    this.features.push(feature);
  }
}

module.exports = FeatureCollection;
