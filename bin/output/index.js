'use strict';

const chalk = require('chalk');
const ora = require('ora');

class Output {
  constructor() {
    this.raw = false;
  }
  
  /**
   * @param {Promise|*} action
   * @param {*} options
   * @param {boolean} cleanup
   *
   * @returns 
   */
  spin(action, options, cleanup) {
    if (this.raw) {
      return action;
    }
    
    const startTime = Date.now();
    
    options = Object.assign(
      {
        color: 'magenta',
        spinner: 'dots',
      },
      (options && typeof options === 'object') 
        ? options
        : { text: (options || '').toString() }
    );
    
    const spinner = ora(options);
    const printTime = () => {
      const timeColor = chalk.styles.yellow;
      const time = Math.round(Date.now() - startTime);
      spinner.text = `${ spinner.text } ${ timeColor.open }[${ time }ms]${ timeColor.close }`;
      spinner.frame();
    };
  
    spinner.start();
  
    return action
      .then(result => {
        printTime();
        
        if (cleanup) {
          spinner.stop();
        } else {
          spinner.succeed();
        }
        
        return Promise.resolve(result);
      })
      .catch(error => {
        printTime();
        
        if (cleanup) {
          spinner.stop();
        } else {
          const errorColor = chalk.styles.red;
          spinner.text = `${ spinner.text } ${ errorColor.open + error + errorColor.close }`;
          
          spinner.fail();
        }
        
        return Promise.reject(error);
      });
  }

  /**
   * @returns {Output|*}
   */
  info() {
    return this._log('info', arguments);
  }
  
  /**
   * @returns {Output|*}
   */
  log() {
    return this._log('log', arguments);
  }
  
  /**
   * @returns {Output|*}
   */
  warn() {
    return this._log('warn', arguments);
  }
  
  /**
   * @returns {Output|*}
   */
  error() {
    return this._log('error', arguments);
  }
  
  /**
   */
  succeed() {
    this.info.apply(this, arguments);
    process.exit(0);
  }
  
  /**
   */
  fail() {
    this.error.apply(this, arguments);
    process.exit(1);
  }
  
  /**
   * @param {string} type
   * @param {array} args
   *
   * @returns {Output|*}
   */
  _log(type, args) {
    if (this.raw && ['info', 'warn'].indexOf(type) !== -1) {
      return this;
    }
    
    let color;
    let handler;
    
    switch (type) {
      case 'log':
        handler = console.log;
        break;
      case 'info':
        color = chalk.styles.green;
        handler = console.info;
        break;
      case 'warn':
        color = chalk.styles.yellow;
        handler = console.warn;
        break;
      case 'error':
        color = chalk.styles.red;
        handler = console.error;
        break;
    }
    
    let argsVector = [];
    
    for (let i = 0; i < args.length; i++) {
      argsVector.push(args[i]);
    }
    
    if (color) {
      argsVector.unshift(color.open);
      argsVector.push(color.close);
    }
    
    handler.apply(console, argsVector);
    
    return this;
  }
}

module.exports = new Output;
