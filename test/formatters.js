var tap = require('tap');

var lib = require('../lib/lib.js');

tap.test('formats the reviewer name and email', function (t) {
  var res = lib.formatReviewedByMetaData({name: 'Kerstin', email: 'uschi@example.com'});
  t.equal('Kerstin <uschi@example.com>', res);
  t.end();
});

tap.test('omits the email if no email given', function (t) {
  var res = lib.formatReviewedByMetaData({name: 'Kerstin'});
  t.equal('Kerstin', res);
  t.end();
});
