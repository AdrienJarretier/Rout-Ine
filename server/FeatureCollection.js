class FeatureCollection {
  constructor(featuresArray) {
    this.type = 'FeatureCollection';
    this.features = featuresArray;
  }

  push(feature) {
    this.features.push(feature);
  }

  get length() {
    return this.features.length;
  }
}

module.exports = FeatureCollection;
