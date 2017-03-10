'use strict';

const PThrottler = require('p-throttler');

class AwsRequestStack {
  /**
   * @param {number} concurrency
   */
  constructor(concurrency) {
    this.throttler = PThrottler.create(concurrency || 5);
    this.retryTimeout = 200;
    this.wrapper = null;
  }
  
  /**
   * @param {*} service
   * @param {string} method
   * @param {*} options
   * @param {boolean} skipWrap
   *
   * @returns {Promise|*}
   */
  handle(service, method, options, skipWrap) {
    const handler = this.throttler.enqueue(() => {
      return service[method].call(service, options)
        .promise()
        .catch(error => {
          if (this._throttleErrors().indexOf(error.code) !== -1) {
            return new Promise((resolve, reject) => {
              setTimeout(() => {
                this.handle(service, method, options)
                  .then(resolve).catch(error);
              }, this.retryTimeout);
            });
          }
          
          return Promise.reject(error);
        });
    });
    
    return !skipWrap && this.wrapper 
      ? this.wrapper(handler, service, method, options) 
      : handler;
  }
  
  /**
   * @returns {string[]}
   *
   * @private
   */
  _throttleErrors() {
    return [ 'ThrottlingException', 'TooManyRequestsException' ];
  }
}

module.exports = AwsRequestStack;
