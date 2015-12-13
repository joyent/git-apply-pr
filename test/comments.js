var tap = require('tap');
var nock = require('nock');

var lib = require('../lib/lib.js');
var fixtures = require('./fixtures');

tap.test('it succceeds for lgtm in code comments', function (t) {
  nock('https://api.github.com')
    .get('/repos/test/test/pulls/1337/comments?page=1&per_page=100')
    .reply(200, fixtures.lgtmInCodeComment);

  nock('https://api.github.com')
    .get('/repos/test/test/issues/1337/comments?page=1&per_page=100')
    .reply(200, []);

  var config = {ENABLE_PLUS_ONE: false};
  var prInfo = {OWNER: 'test', REPO: 'test', PR: 1337};

  lib.getComments(prInfo, config, 1, function (prInfo, config, res) {
    t.same(res, {trentm: 1});
    t.end();
  });
});

tap.test('it succceeds for lgtm in issue comments', function (t) {
  nock('https://api.github.com')
    .get('/repos/test/test/pulls/1337/comments?page=1&per_page=100')
    .reply(200, []);

  nock('https://api.github.com')
    .get('/repos/test/test/issues/1337/comments?page=1&per_page=100')
    .reply(200, fixtures.plusOneInIssueComment);

  var config = {ENABLE_PLUS_ONE: true};
  var prInfo = {OWNER: 'test', REPO: 'test', PR: 1337};
  lib.getComments(prInfo, config, 1, function (prInfo, config, res) {
    t.same(res, {kxepal: 1});
    t.end();
  });
});
