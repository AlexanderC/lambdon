'use strict';

class Lambda {
  /**
   * @param {AWS.Lambda|*} lambda
   * @param {AwsRequestStack|*} requestStack
   */
  constructor(lambda, requestStack) {
    this.lambda = lambda;
    this.requestStack = requestStack;
  }
  
  /**
   * @returns {Promise|*}
   */
  list() {
    return this._list();
  }
  
  /**
   * @param {string} marker
   * 
   * @returns {Promise|*}
   *
   * @private
   */
  _list(marker) {
    const options = {};
    
    if (marker) {
      options.Marker = marker;
    }
    
    return this.requestStack
      .handle(this.lambda, 'listFunctions', options)
      .then(data => {
        const functions = data.Functions || [];
        
        if (data.NextMarker) {
          return this._list(data.NextMarker)
            .then(nestedFunctions => {
              return Promise.resolve(functions.concat(nestedFunctions));
            });
        }
        
        return Promise.resolve(functions);
      });
  }
}

module.exports = Lambda;
