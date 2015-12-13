var spawnSync = require('child_process').spawnSync;

var tap = require('tap');


tap.test('it succceeds for lgtm in code comments', function (t) {
  var out = spawnSync('node', [
    './apply-pr.js', '--plusone', 'apache/couchdb-fauxton#321'
  ], {cwd: __dirname + '/..'});

  t.match(out.stdout, /PR: #321/);
  t.match(out.stdout, /fix error where specific files/);
  t.match(out.stdout, /PR-URL: https:\/\/github.com\/apache\/couchdb-fauxton\/pull\/321/);
  t.match(out.stdout, /Reviewed-By: Alexander Shorin <null>/);
  t.end();
});
