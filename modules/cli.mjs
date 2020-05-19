#!/usr/bin/env node
'use strict';

// Usage: eevee [init, start, stop, restart, config, status, console, dump]

const ident = 'cli';
const debug = true;

import { default as clog } from 'ee-log';
import { default as yargs } from 'yargs';
import { ipc, lockPidFile, exit, handleSIGINT, genMessageID } from '../lib/common.mjs';

// Create and lock a pid file at /tmp/eevee/proc/eevee-pm.pid
lockPidFile(ident);

if (debug) {
  ipc.on('start', () => {
    if (debug) clog.debug('IPC "connected"');
    // Print every message we receive if debug is enabled
    ipc.subscribe(`${ident}.#`, (data, info) => {
      clog.debug('Incoming IPC message: ', JSON.stringify(JSON.parse(data.toString()), null, 2), info);
    });
  });
}

process.on('SIGINT', () => {
  handleSIGINT(ident, ipc);
});

ipc.on('start', () => {
  const argv = yargs
    .usage('Usage: $0 <command> [options]')
    .command({
      command: 'status [module]',
      desc: 'Show bot or module status',
      handler: (argv) => {
        status(argv, (exitCode) => {
          exit(ident, exitCode);
        });
      },
    })
    .command({
      command: 'start <module>',
      desc: 'Ask eevee-pm to start a module',
      builder: (yargs) => {
        yargs.positional('module', {
          describe: 'The module to start',
          type: 'string',
        });
      },
      handler: (argv) => {
        start(argv, (exitCode) => {
          exit(ident, exitCode);
        });
      },
    })
    .command({
      command: 'stop <module>',
      desc: 'Ask eevee-pm to stop a module',
      builder: (yargs) => {
        yargs.positional('module', {
          describe: 'The module to stop',
          type: 'string',
        });
      },
      handler: (argv) => {
        stop(argv, (exitCode) => {
          exit(ident, exitCode);
        });
      },
    })
    .command({
      command: 'restart <module>',
      desc: 'Ask eevee-pm to restart a module',
      builder: (yargs) => {
        yargs.positional('module', {
          describe: 'The module to restart',
          type: 'string',
        });
      },
      handler: (argv) => {
        stop(argv, (stopCode) => {
          start(argv, (startCode) => {
            exit(ident, stopCode + startCode);
          });
        });
      },
    })
    .showHelpOnFail(true)
    .demandCommand(1, '')
    .strict()
    .help().argv;

  if (debug) clog.debug(argv);
});

function start(argv, cb) {
  clog.debug('argv: ', argv);

  if (debug) clog.debug('IPC "connected"');

  const messageID = genMessageID();
  clog.debug('Sending start request');
  const message = JSON.stringify({
    messageID: messageID,
    target: argv.module,
    notify: ident,
    action: 'start', // Not strictly required as we're going to publish to eevee-pm.request.start
  });
  ipc.publish('eevee-pm.request.start', message);
  ipc.subscribe(`${ident}.reply`, (data, info) => {
    data = JSON.parse(data);
    clog.debug('Reply message: ', data, info);
    if (data.result === 'success' && data.messageID === messageID) {
      // eslint-disable-next-line prettier/prettier
        console.log(`Command: "start ${argv.module}" completed successfully (pid is ${data.childPID})`,);
      if (cb) cb(0);
      return 0;
    } else if (data.result === 'fail' && data.messageID === messageID) {
      var string = null;
      if (data.err.code === 'E_ALREADY_RUNNING') {
        string = `Command "start ${argv.module}" failed: ${data.err.code} (at ${data.err.path}).\n`;
        string += `Module already running? (pid ${data.childPID})`;
      } else {
        string = `Command "start ${argv.module}" failed: Unknown error:\n`;
        string += JSON.stringify(data.err, null, 2);
      }
      console.log(string);
      if (cb) cb(1);
      return 1;
    }
  });
}

function stop(argv, cb) {
  clog.debug('argv: ', argv);
  if (debug) clog.debug('IPC "connected"');
  const messageID = genMessageID();
  clog.debug('Sending stop request');
  const message = JSON.stringify({
    messageID: messageID,
    target: argv.module,
    notify: ident,
    action: 'stop',
  });
  ipc.publish('eevee-pm.request.stop', message);
  ipc.subscribe(`${ident}.reply`, (data, info) => {
    data = JSON.parse(data);
    clog.debug('Reply message: ', data, info);
    if (data.result === 'success' && data.messageID === messageID) {
      // eslint-disable-next-line prettier/prettier
        console.log(`Command: stop ${argv.module} completed successfully (pid was ${data.childPID})`);
      if (cb) cb(0);
      return 0;
    } else if (data.result === 'fail' && data.messageID === messageID) {
      var string = null;
      if (data.err.code === 'ENOENT') {
        string = `Command "stop ${argv.module}" failed: ${data.err.code} at ${data.err.path}. Module not running?`;
      } else {
        string = `Command "stop ${argv.module}" failed: Unknown error:\n`;
        string += JSON.stringify(data.err, null, 2);
      }
      console.log(string);
      if (cb) cb(1);
      return 1;
    }
  });
}

function status(argv, cb) {
  clog.debug('argv: ', argv);
  if (debug) clog.debug('IPC "connected"');
  const messageID = genMessageID();
  clog.debug('Sending status request');
  var message = null;
  if (argv.module) {
    message = JSON.stringify({
      messageID: messageID,
      target: argv.module,
      notify: ident,
      action: 'moduleStatus',
    });
    ipc.publish('eevee-pm.request.moduleStatus', message);
  } else {
    message = JSON.stringify({
      messageID: messageID,
      target: null,
      notify: ident,
      action: 'status',
    });
    ipc.publish('eevee-pm.request.status', message);
  }
  ipc.subscribe(`${ident}.reply`, (data, info) => {
    data = JSON.parse(data);
    clog.debug('Reply message: ', data, info);
    if (data.result === 'success' && data.messageID === messageID) {
      if (data.command === 'moduleStatus') {
        // eslint-disable-next-line prettier/prettier
          console.log(`Command: "status ${argv.module}" completed successfully (pid is ${data.childPID})`);
        exit(ident);
      } else if (data.command === 'status') {
        var string1 = `Command: "status" completed successfully. Running modules: \n`;
        string1 += JSON.stringify(data.childPID, null, 2);
        console.log(string1);
        if (cb) cb(0);
        return 0;
      }
    } else if (data.result === 'fail' && data.messageID === messageID) {
      var string2 = null;
      string2 = `Command "status ${argv.module}" failed: Unknown error:\n`;
      string2 += JSON.stringify(data.err, null, 2);
      console.log(string2);
      if (cb) cb(1);
      return 1;
    }
  });
}
