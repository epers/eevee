'use strict';

const clog = require('ee-log');
const nrp = require('node-redis-pubsub');

const ipc = new nrp({
  port: 6379,
  scope: 'helloworld',
});

ipc.on('reply', (data) => {
  clog.debug('reply received:', data);
});

ipc.on('error', (error) => {
  clog.error('ERRORERRORERROR', error);
});

setTimeout(() => {
  ipc.emit('msg', {
    hello: 'world',
    foo: 'bar',
    baz: 'ddd',
    fizz: 'buzz',
    a: 'b',
    f: false,
    nu: null,
    twentyseven: 27,
  });
}, 2000);

process.on('SIGINT', () => {
  ipc.removeAllListeners();
  ipc.quit();
  process.exitCode = 0;
});