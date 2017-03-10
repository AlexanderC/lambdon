#!/usr/bin/env node

'use strict';

const output = require('./output');
const inquirer = require('inquirer');
const lambdonLib = require('../index');
const npmPackage = require('../package.json');

const argv = require('yargs')
    .usage('Usage: $0 -m "hello" --integrations [options]')
    .option('profile', {
      alias: 'p',
      describe: 'AWS Profile to use',
    })
    .option('region', {
      alias: 'r',
      describe: 'AWS Region to use',
      default: 'us-east-1',
    })
    .option('match', {
      alias: 'm',
      describe: 'AWS Lambda functions match string',
    })
    .option('integrations', {
      describe: 'Include AWS Lambda > ApiGateway integrations',
    })
    .option('log-group', {
      alias: 'g',
      describe: 'Specify explicit the AWS CloudWatchLogs group to listen to',
      default: false,
    })
    .option('concurrency', {
      describe: 'AWS api calls concurrency',
      default: 5,
    })
    .option('top-n', {
      alias: 'n',
      describe: 'Top N CloudWatchLogs streams to listen by lastEventTimestamp',
      default: 9999,
    })
    .option('timeout', {
      alias: 't',
      describe: 'Empty logs timeout before the program ends',
      default: 0,
    })
    .option('pooling-interval', {
      alias: 'i',
      describe: 'CloudWatchLogs streams pooling interval',
      default: 50,
    })
    .option('retry-timeout', {
      describe: 'Retry timeout for throttled AWS api calls',
      default: 200,
    })
    .option('raw', {
      describe: 'Enable raw output',
      default: false,
    })
    .option('version', {
      alias: 'v',
      describe: 'Program version',
    })
    .help('h')
    .alias('h', 'help')
    .boolean('integrations')
    .boolean('version')
    .epilog(npmPackage.copyright)
    .argv;

if (argv.version) {
  return output.succeed(npmPackage.name, npmPackage.version);
}

const lambdon = lambdonLib.create(argv)
  .setTimeout(argv.timeout)
  .setTopN(argv['top-n'])
  .setPoolingInterval(argv['pooling-interval'])
  .setRetryTimeout(argv['retry-timeout']);

lambdon.requestStack.wrapper = (handler, service, method, options) => {
  if (method === 'getLogEvents') {
    return handler;
  }
  
  return output.spin(
    handler,
    {
      text: `aws::${ service.endpoint.host }::${ method }`,
    },
    true
  );
};

output.raw = argv.raw;

if (argv['log-group']) {
  return new Promise((resolve, reject) => {
    output.info(`Start listening to logs for ${ argv['log-group'] }`);
    
    lambdon
      .tail(argv['log-group'])
      .catch(reject)
      .finally(() => resolve())
      .subscribe(
        entry => {
          output.log(
            new Date(entry.timestamp).toTimeString(), 
            entry.message.trim()
          );
        },
        error => reject(error)
      );
  })
  .then(() => {
    if (argv.timeout > 0) {
      output.succeed(`No logs received after ${ argv.timeout }ms`);
    } else {
      output.succeed(`There are no log streams available`);
    }
  })
  .catch(error => output.fail(error));
}

output
  .spin(
    lambdon.listFunctions(), 
    argv.match 
      ? `Load Lambda functions list matching string "${ argv.match }"`
      : 'Load Lambda functions list'
  )
  .then(functions => {
    if (argv.match) {
      return Promise.resolve(functions.filter(func => {
        return func.FunctionName.toLowerCase()
          .indexOf(argv.match.toLowerCase()) !== -1;
      }));
    }
    
    return Promise.resolve(functions);
  })
  .then(functions => {
    const result = { functions };
    
    if (argv.function) {
      result.function = argv.function;
      
      return Promise.resolve(result);
    } else if (functions.length <= 0) {
      return output.succeed('The are no AWS Lambda functions so far...');
    } else if (functions.length === 1) {
      result.function = functions[0].FunctionName;
      
      return Promise.resolve(result);
    }
    
    if (argv.raw) {
      return output.fail(`Raw mode (--raw) is not compatible with interactive options`);
    }
    
    return inquirer.prompt({
      type: 'list',
      name: 'function',
      message: 'Select Lambda function you want to debug',
      choices: functions.map(func => func.FunctionName),
      pageSize: 10,
    }).then(answer => {
      result.function = answer.function;
      
      return Promise.resolve(result);
    });
  })
  .then(result => {
    for (let i = 0; i < result.functions.length; i++) {
      if (result.functions[i].FunctionName === result.function) {
        return result.functions[i];
      }
    }
    
    return output.fail(`Missing AWS Lambda function ${ result.function }`);
  })
  .then(lambda => {
    return new Promise((resolve, reject) => {
      output.info(
        `Start listening to logs for ${ lambda.FunctionName }`, 
        argv.integrations ? '(+integrations)' : ''
      );
      
      lambdon
        .tailFunction(lambda.FunctionName, argv.integrations)
        .catch(reject)
        .finally(() => resolve())
        .subscribe(
          entry => {
            output.log(
              new Date(entry.timestamp).toTimeString(), 
              entry.message.trim()
            );
          },
          error => reject(error)
        );
    });
  })
  .then(() => {
    if (argv.timeout > 0) {
      output.succeed(`No logs received after ${ argv.timeout }ms`);
    } else {
      output.succeed(`There are no log streams available`);
    }
  })
  .catch(error => output.fail(error));
