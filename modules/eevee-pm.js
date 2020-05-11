'use strict';

// Process manager for eevee-bot

const ident = 'eevee-pm';
const debug = true;

const clog = require('ee-log');

const common = require('../lib/common.js');

// This checks and creates the dirs in /tmp if necessary
const procPath = common.createProcDir();
const ipc = common.ipc();
const lock = common.lock(ident);

// Print every message we receive if debug is enabled
if (debug) {
  ipc.subscribe(`${ident}.#`, (data, info) => {
    clog.debug('incoming IPC message: ', info.toString('utf8'), data.toString('utf8'));
  });
}

// Things that need to be done once the ipc is "connected"
ipc.on('start', () => {
  if (debug) clog.debug('IPC "connected"');
});

process.on('SIGINT', () => {
  common.handleSIGINT(ident, ipc, lock);
});
