'use strict';

const Rx = require('rxjs/Rx');
const Lambda = require('./service/lambda');
const CWLogs = require('./service/cwlogs');
const APG = require('./service/apg');
const requestStack = require('./awsRequestStack');

class Lambdon {
  /**
   * @param {AWS|*} aws
   * @param {number} concurrency
   */
  constructor(aws, concurrency) {
    this.aws = aws;
    this.requestStack = new requestStack(concurrency);
    this.lambda = new Lambda(new aws.Lambda, this.requestStack);
    this.logs = new CWLogs(new aws.CloudWatchLogs, this.requestStack);
    this.apg = new APG(new aws.APIGateway, this.requestStack);
  }
  
  /**
   * @param {number} topN
   *
   * @returns {Lambdon|*}
   */
  setTopN(topN) {
    this.logs.topN = topN;
    
    return this;
  }
  
  /**
   * @param {number} retryTimeout
   *
   * @returns {Lambdon|*}
   */
  setRetryTimeout(retryTimeout) {
    this.requestStack.retryTimeout = retryTimeout;
    
    return this;
  }
  
  /**
   * @param {number} timeout
   *
   * @returns {Lambdon|*}
   */
  setTimeout(timeout) {
    this.logs.timeout = timeout;
    
    return this;
  }
  
  /**
   * @param {number} interval
   *
   * @returns {Lambdon|*}
   */
  setPoolingInterval(interval) {
    this.logs.interval = interval;
    
    return this;
  }
  
  /**
   * @returns {Promise|*}
   */
  listFunctions() {
    return this.lambda.list();
  }
  
  /**
   * @param {string} lambda
   * @param {boolean} includeIntegrations
   *
   * @returns {Observable|*}
   */
  tailFunction(lambda, includeIntegrations) {
    if (!includeIntegrations) {
      return this.logs.tailLambdaLogs(lambda);
    }
    
    const apiTails = 
      Rx.Observable.fromPromise(
        this._functionIntegrationsPromise(lambda)
      ).map(stages => {
        return Rx.Observable.merge.apply(
          Rx.Observable,
          stages.map(stage => {
            return this.logs.tailApiLogs(
              stage.api.id,
              stage.stageName
            );
          })
        );
      });

    return Rx.Observable.merge(
      this.logs.tailLambdaLogs(lambda),
      apiTails.flatMap(flat => flat)
    );
  }
  
  /**
   * @param {string} lambda
   *
   * @returns {Promise|*}
   *
   * @private
   */
  _functionIntegrationsPromise(lambda) {
    const integrationsPromise = this.apg.findLambdaIntegrations(lambda);
    
    return this.apg.findLambdaIntegrations(lambda)
      .then(integrations => {
        const apis = [];
        const stagePromises = [];
        const allStages = [];
        
        integrations.forEach(integration => {
          if (apis.indexOf(integration.api.id) === -1) {
            apis.push(integration.api.id);
            stagePromises.push(
              this.apg.listStages(integration.api)
                .then(stages => {
                  stages.forEach(stage => {
                    stage.api = integration.api;
                    allStages.push(stage);
                  });
                })
            );
          }
        });
        
        if (stagePromises.length <= 0) {
          return Promise.resolve([]);
        }

        return Promise.all(stagePromises)
          .then(() => Promise.resolve(allStages));
      })
      .then(stages => {
        return Promise.resolve(stages.filter(stage => {
          return stage.methodSettings.hasOwnProperty('*/*')
            && stage.methodSettings['*/*'].loggingLevel;
        }));
      });
  }
  
  /**
   * @param {string} logGroupName
   *
   * @returns {Observable|*}
   */
  tail(logGroupName) {
    return this.logs.tailLogs(logGroupName);
  }
}

module.exports = Lambdon;
