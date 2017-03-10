'use strict';

const Lambdon = require('./lib/lambdon');
const AWS = require('aws-sdk');

module.exports = {
  Lambdon, AWS, create(options) {
    options = options || {};
    
    if (options.profile) {
      const credentials = new AWS.SharedIniFileCredentials({ profile: options.profile });
      
      AWS.config.credentials = credentials;
    }
    
    if (options.region) {
      AWS.config.region = options.region;
    }
    
    return new Lambdon(AWS, options.concurrency);
  }
};
