'use strict';

// All modules will use this stuff
// Sets up the IPC connection, pid file, and baseline SIGINT handling

import * as fs from 'fs';
import { default as qfsq } from 'qlobber-fsq';
import { default as lock } from 'lockfile';
import { default as clog } from 'ee-log';
import path from 'path';
import { fileURLToPath } from 'url';

const procPath = '/tmp/eevee';

export const ipc = new qfsq.QlobberFSQ({ fsq_dir: `${procPath}/ipc` });

export function lockPidFile(ident) {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(`${procPath}/proc`)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.mkdirSync(`${procPath}/proc`, { recursive: true });
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(`${procPath}/ipc`)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.mkdirSync(`${procPath}/ipc`, { recursive: true });
    }
  } catch (err) {
    clog.error(`[${ident}] Could not create proc directory at ${procPath}`, err);
    if (err) throw new Error(`Could not create proc directory at ${procPath}`);
  }

  lock.lock(`${procPath}/proc/${ident}.pid`, (err) => {
    if (err) throw new Error(`Unable to acquire lock ${procPath}/proc/${ident}.pid (Process already running?)`, err);
  });
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  fs.writeFileSync(`${procPath}/proc/${ident}.pid`, process.pid.toString(), 'utf8');
}

export function unlockPidFile(ident) {
  lock.unlock(`${procPath}/proc/${ident}.pid`, (err) => {
    if (err) throw new Error(`Unable to acquire lock ${procPath}/proc/${ident}.pid (Process already running?)`, err);
  });
}

export function handleSIGINT(ident, ipc, debug) {
  if (debug) console.log('\nReceived SIGINT, cleaning up... (repeat to force)');
  process.removeAllListeners('SIGINT');
  process.on('SIGINT', () => {
    throw new Error('Received SIGINT twice, forcing exit.');
  });
  setTimeout(() => {
    throw new Error('Timeout expired, forcing exit.');
  }, 5000).unref();
  ipc.unsubscribe();
  ipc.stop_watching();
  ipc.removeAllListeners();
  lock.unlockSync(`${procPath}/proc/${ident}.pid`);
  process.exitCode = 0;
}

export function exit(ident, code) {
  setTimeout(() => {
    throw new Error('Timeout expired, forcing exit.');
  }, 5000).unref();
  ipc.unsubscribe();
  ipc.stop_watching();
  ipc.removeAllListeners();
  process.removeAllListeners();
  unlockPidFile(ident);
  code ? (process.exitCode = code) : (process.exitCode = 0);
}

export function genMessageID() {
  const charset = 'ABCDEF0123456789';
  const N = 8;
  const id = Array(N)
    .map(() => {
      return charset.charAt(Math.floor(Math.random() * charset.length));
    })
    .join('');
  return id;
}

export const __dirname = getDirName();

export function getDirName() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return __dirname;
}
