'use strict';

class APG {
  /**
   * @param {AWS.ApiGateway|*} apg
   * @param {AwsRequestStack|*} requestStack
   */
  constructor(apg, requestStack) {
    this.apg = apg;
    this.requestStack = requestStack;
  }
  
  /**
   * @param {string} lambdaName
   *
   * @returns {Promise|*}
   */
  findLambdaIntegrations(lambdaName) {
    return this.listApis()
      .then(apis => {
        const result = [];
        
        return Promise.all(apis.map(api => {
          return this.listResources(api)
            .then(resources => {
              return Promise.all(resources.map(resource => {
                return this.listIntegrations(api, resource)
                  .then(integrations => {
                    integrations.forEach(integration => {
                      result.push({
                        api,
                        resource,
                        integration,
                      });
                    });
                  });
              }));
            });
        })).then(() => Promise.resolve(result));
      })
      .then(response => {
        return Promise.resolve(response.filter(item => {
          return item.integration.type === 'AWS' 
            && this._matchLambdaUri(item.integration.uri)
            && item.integration.uri.indexOf(lambdaName) !== -1;
        }));
      });
  }
  
  /**
   * @param {*} api
   *
   * @returns {Promise|*}
   */
  listStages(api) {
    return this.requestStack
      .handle(this.apg, 'getStages', { restApiId: api.id })
      .then(data => Promise.resolve(data.item));
  }
  
  /**
   * @param {*} api
   * @param {*} resource
   *
   * @returns {Promise|*}
   */
  listIntegrations(api, resource) {
    const integrations = [];
     
    return Promise.all(
      Object.keys(resource.resourceMethods || {})
        .map(httpMethod => {
          return this._getIntegration(api.id, resource.id, httpMethod)
            .then(integration => integrations.push(integration));
        })
    ).then(() => Promise.resolve(integrations));
  }
  
  /**
   * @param {string} restApiId
   * @param {string} resourceId
   * @param {string} httpMethod
   *
   * @returns {Promise|*}
   *
   * @private
   */
  _getIntegration(restApiId, resourceId, httpMethod) {
    return this.requestStack
      .handle(
        this.apg, 
        'getIntegration', 
        { restApiId, resourceId, httpMethod }
      );
  }
  
  /**
   * @param {*} api
   *
   * @returns {Promise|*}
   */
  listResources(api) {
    return this._listResources(api.id);
  }
  
  /**
   * @param {string} restApiId
   * @param {string} position
   *
   * @returns {Promise|*}
   *
   * @private
   */
  _listResources(restApiId, position) {
    const options = { limit: 500, restApiId };
    
    if (position) {
      options.position = position;
    }
    
    return this.requestStack
      .handle(this.apg, 'getResources', options)
      .then(data => {
        const resources = data.items || [];
        
        if (data.position && resources.length > 0) {
          return this._listResources(restApiId, data.position)
            .then(nestedResources => {
              return Promise.resolve(resources.concat(nestedResources));
            });
        }
        
        return Promise.resolve(resources);
      });
  }
  
  /**
   * @returns {Promise|*}
   */
  listApis() {
    return this._listApis();
  }
  
  /**
   * @param {string} position
   * 
   * @returns {Promise|*}
   *
   * @private
   */
  _listApis(position) {
    const options = { limit: 500 };
    
    if (position) {
      options.position = position;
    }
    
    return this.requestStack
      .handle(this.apg, 'getRestApis', options)
      .then(data => {
        const apis = data.items || [];
        
        if (data.position && apis.length > 0) {
          return this._listApis(data.position)
            .then(nestedApis => {
              return Promise.resolve(apis.concat(nestedApis));
            });
        }
        
        return Promise.resolve(apis);
      });
  }
  
  /**
   * @param {string} uri
   *
   * @return {boolean}
   *
   * @private
   */
  _matchLambdaUri(uri) {
    return /^arn:aws:apigateway:[a-z0-9-]*:lambda:path\/[a-z0-9-]+\/functions\/arn:aws:lambda:[a-z0-9-]*:[a-z0-9]+:function:[^\/]+\/invocations$/i.test(uri);
  }
}

module.exports = APG;
