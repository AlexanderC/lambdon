'use strict';

const Rx = require('rxjs/Rx');

class CWLogs {
  /**
   * @param {AWS.CloudWatchLogs|*} cwlogs
   * @param {AwsRequestStack|*} requestStack
   */
  constructor(cwlogs, requestStack) {
    this.cwlogs = cwlogs;
    this.topN = 10;
    this.timeout = 0;
    this.interval = 50;
    this.requestStack = requestStack;
  }
  
  /**
   * @param {string} apiId
   * @param {string} stageName
   * 
   * @returns {Observable|*}
   */
  tailApiLogs(apiId, stageName) {
    return this.tailLogs(
      this._generateApiLogGroupName(apiId, stageName)
    );
  }
  
  /**
   * @param {string} lambda
   * 
   * @returns {Observable|*}
   */
  tailLambdaLogs(lambda) {
    return this.tailLogs(this._lambdaLogGroupName(lambda));
  }
  
  /**
   * @param {string} logGroupName
   * 
   * @returns {Observable|*}
   */
  tailLogs(logGroupName) {
    const observable = Rx.Observable.create(observer => {
      const startTime = Date.now();

      this._logStreams(logGroupName)
        .then(logStreams => {
          const logStreamsNames = this._filterLogStreams(logStreams)
            .map(stream => stream.logStreamName);
          
          if (logStreamsNames.length <= 0) {
            return Promise.resolve();
          }
          
          return Promise.all(
            logStreamsNames.map(logStreamName => {
              return this._listenToLogStream(
                logGroupName, 
                logStreamName, 
                startTime, 
                observer
              );
            })
          );
        })
        .then(() => observer.complete())
        .catch(error => observer.error(error));
    });
    
    return observable;
  }
  
  /**
   * @param {array} logStreams
   *
   * @returns {array}
   *
   * @private
   */
  _filterLogStreams(logStreams) {
    const filteredLogStreams = logStreams.sort((a, b) => {
      const aTime = a.lastEventTimestamp || 0;
      const bTime = b.lastEventTimestamp || 0;
      
      if (aTime > bTime) {
        return -1;
      }
      
      if (aTime < bTime) {
        return 1;
      }

      return 0;
    });
    
    while (filteredLogStreams.length > this.topN) {
      filteredLogStreams.pop();
    }
    
    return filteredLogStreams;
  }
  
  /**
   * @param {string} logGroupName
   * @param {string} logStreamName
   * @param {number} startTime
   * @param {Observable|*} observer
   * @param {number} _noResultsTimeout
   * @param {string} _nextToken
   *
   * @returns {Promise|*}
   * 
   * @private
   */
  _listenToLogStream(logGroupName, logStreamName, startTime, observer, _noResultsTimeout, _nextToken) {
    _noResultsTimeout = _noResultsTimeout || 0;
    const options = { logGroupName, logStreamName, startTime, startFromHead: true };
    
    if (_nextToken) {
      options.nextToken = _nextToken;
    }
    
    return this.requestStack
      .handle(this.cwlogs, 'getLogEvents', options)
      .then(data => {
        const events = (data.events || []);
        
        events.forEach(logEntry => {
          logEntry.logStreamName = logStreamName;
          
          observer.next(logEntry);
        });
        
        if (events.length <= 0) {
          _noResultsTimeout += this.interval;
        } else {
          _noResultsTimeout = 0;
        }
        
        if (this.timeout > 0 && _noResultsTimeout >= this.timeout) {
          return Promise.resolve();
        }
        
        if (data.nextForwardToken) {          
          return new Promise(resolve => {
            setTimeout(() => {
              this._listenToLogStream(
                logGroupName, logStreamName, startTime, observer,
                _noResultsTimeout, data.nextForwardToken
              ).then(() => resolve());
            }, this.interval);
          });
        }
      })
      .catch(error => observer.error(error));
  }

  /**
   * @param {string} logGroupName
   * @param {string} _nextToken 
   * @param {number} _noResultsTimeout
   *
   * @returns {Promise|*}
   *
   * @private
   */
  _logStreams(logGroupName, _nextToken, _noResultsTimeout) {
    _noResultsTimeout = _noResultsTimeout || 0;
    const options = { logGroupName };
    
    if (_nextToken) {
      options.nextToken = _nextToken;
    }
    
    return this.requestStack
      .handle(
        this.cwlogs, 
        'describeLogStreams', 
        options, 
        _noResultsTimeout > 0
      )
      .then(data => {
        const logStreams = data.logStreams || [];
        
        if (data.nextToken) {
          return this._logStreams(logGroupName, data.nextToken)
            .then(nestedLogStreams => {
              return logStreams.concat(nestedLogStreams);
            });
        }
        
        return Promise.resolve(logStreams);
      })
      .catch(error => {
        
        // the log group doesn't yet exist, wait for it
        if (error.code === 'ResourceNotFoundException' && !_nextToken) {
          return new Promise((resolve, reject) => {
            _noResultsTimeout += this.interval;
            
            if (this.timeout > 0 && _noResultsTimeout >= this.timeout) {
              return resolve([]);
            }
            
            setTimeout(() => {
              this._logStreams(logGroupName, null, _noResultsTimeout)
                .then(resolve).catch(reject);
            }, this.interval);
          });
        }
        
        return Promise.reject(error);
      });
  }
  
  /**
   * @param {string} apiId
   * @param {string} stageName
   * 
   * @returns {string}
   * 
   * @private
   */
  _generateApiLogGroupName(apiId, stageName) {
    return `API-Gateway-Execution-Logs_${ apiId }/${ stageName }`;
  }
  
  /**
   * @param {string} lambda
   *
   * @returns {string}
   *
   * @private
   */
  _lambdaLogGroupName(lambda) {
    return `/aws/lambda/${ lambda }`;
  }
}

module.exports = CWLogs;
