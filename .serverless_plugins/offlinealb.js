'use strict';

class Handler {
  constructor( h ) {
    this.fileName = h.split( "." )[ 0 ];
    this.moduleName = h.split( "." )[ 1 ];
  }
}

function getLambdaEventAlbContext ( e ) {
  return { 
    requestContext: { 
      elb: { 
        targetGroupArn: 'arn:aws:elasticloadbalancing:eu-west-1:550213415212:targetgroup/5811b5d6aff964cd50efa8596604c4e0/b49d49c443aa999f' 
      } 
    },
    httpMethod: e.method,
    path: e.path,
    queryStringParameters: e.queryParams,
    headers: e.headers,
    body: '',
    isBase64Encoded: false
  }
};

function getLambdaContext ( functionName, memoryLimit ) {
  return { 
    callbackWaitsForEmptyEventLoop: null,
    done: [ function done () {} ],
    succeed: [ function succeed () {} ],
    fail: [ function fail() {} ],
    logGroupName: `/aws/lambda/${functionName}`,
    logStreamName: '2019/11/19/[$LATEST]81b1f2daab94473cb583a6122871285a',
    functionName: functionName,
    memoryLimitInMB: memoryLimit,
    functionVersion: '$LATEST',
    getRemainingTimeInMillis: [ function getRemainingTimeInMillis () {} ],
    invokeid: 'e7c283d1-8139-4201-80ff-701fcad0ccae',
    awsRequestId: 'e7c283d1-8139-4201-80ff-701fcad0ccae',
    invokedFunctionArn: `local:function:${functionName}`
  };
}

class ServerlessPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.commands = {
      offlinealb: {
        usage: 'Helps you start your first Serverless plugin',
        lifecycleEvents: ['start'],
        options: {
          function: {
            usage: 'name the function that you want to run locally',
            required: true,
            shortcut: 'f'
          }
        }
      },
    };

    this.hooks = {
      'offlinealb:start:init': this.start.bind(this),
      'offlinealb:start': this._startWithExplicitEnd.bind(this),
      'offlinealb:start:end': this.end.bind(this)
    };
  }

  async _startWithExplicitEnd() {
    await this.start();
    this.end();
  }

  async start() {
    await this.startServer();
    await this.listenToCommandLine();
    return this._listenForTermination();
  }

  async startServer() {
    const http = require('http');
    const url = require('url');
    const port = 3000;
    const handler = new Handler( this.serverless.service.functions[ this.options.function ].handler );
    const server = http.createServer( ( req, res ) => {
      console.log( res );
      function getQueryParamsFromUrl ( u ) {
        var toParse = u;
        if ( toParse.includes( '?' ) ) {
          return new url.URLSearchParams( toParse.split[ '?' ][ 1 ] );
        }
        return  {};
      }
      this.serverless.cli.log( `Request made for: ${req.url}` );
      let responseBody = '404: not found';
      let responseHeaders = {}
      let responseStatus = 404;
      this.serverless.service.functions[ this.options.function ].events.forEach( ( event ) => {
        if ( 'alb' in event ) {
          if ( event.alb.conditions.path === req.url ) {
            const lambda = require( `../${handler.fileName}` );
            lambda[ handler.moduleName ]( 
              getLambdaEventAlbContext( {
                headers: req.headers,
                queryParams: getQueryParamsFromUrl( req.url ),
                ...event.alb.conditions 
              } ), 
              getLambdaContext( '', this.serverless.service.provider.memorySize || '512' ), 
              ( err, lambdaRes ) => {
                responseBody = lambdaRes.body
                responseHeaders = { ...lambdaRes.headers };
                responseStatus = lambdaRes.statusCode;
              }
            );
          }  
        }
        this.serverless.cli.log( responseStatus );
        Object.keys( responseHeaders ).forEach( ( key ) => {
          res.setHeader( key, responseHeaders[ key ] );
        } );
        res.statusCode = responseStatus;
        res.end(responseBody);
      });
    });
    server.listen( port, ( err ) => {
      if ( err ) {
        return this.serverless.cli.log( 'something bad happened', err );
      }
      this.serverless.cli.log( `server is listening on ${port}` );
    })
  }

  async listenToCommandLine () {
    process.openStdin().addListener('data', (data) => {
      if (data.toString().trim() === 'rp') {
        // reload
      }
    });
  }

  async _listenForTermination() {
    const command = await new Promise( ( resolve ) => {
      process
        // SIGINT will be usually sent when user presses ctrl+c
        .on('SIGINT', () => resolve('SIGINT'))
        // SIGTERM is a default termination signal in many cases,
        // for example when "killing" a subprocess spawned in node
        // with child_process methods
        .on('SIGTERM', () => resolve('SIGTERM'))
    });
    console.log( `Got ${command} signal. Offline Halting...` );
  }

  async end() {
    process.exit( 0 );
  }
}

module.exports = ServerlessPlugin;