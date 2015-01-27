#!/usr/bin/env node

/*
 * The MIT License (MIT)
 * 
 * Copyright (c) 2015 Timothy J Fontaine <tjfontaine@gmail.com>
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

"use strict";

var fs = require('fs');
var https = require('https');
var os = require('os');
var path = require('path');
var spawn = require('child_process').spawn;
var util = require('util');

var Transform = require('stream').Transform;

var lstream = require('lstream');

var HOST = 'github.com';
var OWNER = 'joyent';
var REPO = 'node';

var github = new (require('github'))({
  version: '3.0.0',
  headers: {
    'user-agent': 'git-apply-pr',
  },
});

// TODO XXX FIXME This should probably handle winders
var config = path.join(process.env.HOME, '.gitconfig');

if (fs.existsSync(config)) {
  var match = fs.readFileSync(config, 'utf8').match(/token\s*=\s*([a-f0-9]+)/);

  if (match) {
    github.authenticate({
      type: 'token',
      token: match[1],
    });
  }
}

var PR = +process.argv[2];

//GET /repos/:owner/:repo/pulls/:number

if (typeof(PR) !== 'number' || PR < 1) {
  console.error('PR must be a positive number');
  process.exit(1);
}

var OUTPUT = {
  'PR': util.format('#%d', PR),
  'PR-URL': util.format('/%s/%s/pull/%d', OWNER, REPO, PR),
  'Reviewed-By': {},
};

function getComments(page, next) {
  github.issues.getComments({
    user: OWNER,
    repo: REPO,
    number: PR,
    per_page: 100,
    page: page,
  }, function gotComments(err, comments) {
    if (err) {
      console.error(err);
      process.exit(1);
    }

    var reviews = OUTPUT['Reviewed-By'];

    comments.forEach(function (comment) {
      if (/lgtm/i.test(comment.body)) {
        var val = reviews[comment.user.login] || 0;
        reviews[comment.user.login] = val + 1;
      }
    });

    if (comments.length < 100)
      next();
    else
      getComments(page + 1, next);
  });
}

function resolveNames() {
  var queue = Object.keys(OUTPUT['Reviewed-By']);

  var result = OUTPUT['Reviewed-By'] = [];

  function resolve(err, name) {
    if (err) {
      console.error(err);
      process.exit(1);
    }

    result.push(util.format('%s <%s>', name.name, name.email));

    if (result.length === queue.length)
      applyPatch();
  }

  if (!queue.length) {
    console.error('this PR has not been LGTMd');
    process.exit(1);
  }

  queue.forEach(function(name) {
    github.user.getFrom({ user: name }, resolve);
  });
}

function applyPatch() {
  var req = https.request({
    hostname: HOST,
    path: OUTPUT['PR-URL'] + '.patch',
  }, function patchResponse(res) {
    res.pipe(new lstream()).pipe(new Mutator()).pipe(process.stdout);
  });
  req.end();
}

getComments(1, resolveNames);

function Mutator() {
  Transform.call(this, {
    decodeStrings: false,
    objectMode: true,
  });
  this.m_lineno = 0;
  this.m_message = [];
  this.m_state = 'UNKNOWN';
}
util.inherits(Mutator, Transform);

Mutator.prototype._transform = function mutatorTransform(chunk, encoding, done) {
  this.m_lineno++;

  switch(this.m_state) {
    case 'UNKNOWN':
      if (/^From /.test(chunk))
        this.m_state = 'HEADER';
      break;
    case 'HEADER':
      if (/^Subject: /.test(chunk))
        this.m_state = 'SUBJECT';
      break;
    case 'SUBJECT':
      if (/^---$/.test(chunk)) {
        this.m_state = 'BODY';

        if (this.m_lastline !== '')
          this.m_message.push('');

        this.m_message.push(util.format('PR: %s', OUTPUT['PR']));
        this.m_message.push(util.format('PR-URL: https://%s%s', HOST, OUTPUT['PR-URL']));

        var self = this;

        OUTPUT['Reviewed-By'].forEach(function(user) {
          self.m_message.push(util.format('Reviewed-By: %s', user));
        });

        this.m_message.push(chunk);

        this.push(this.m_message.join(os.EOL) + os.EOL);
        done();
        return;
      }
      break;
    case 'BODY':
      if (/^From /.test(chunk))
        this.m_state = 'HEADER';
      else {
        this.push(chunk + os.EOL);
        done();
        return;
      }
      break;
  }


  this.m_message.push(chunk);

  this.m_lastline = chunk;

  done();
};
