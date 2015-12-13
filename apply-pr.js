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
var path = require('path');
var spawn = require('child_process').spawn;


var lib = require('./lib/lib.js');
var getComments = lib.getComments;
var resolveNames = lib.resolveNames;
var exitWithMsg = lib.exitWithMsg
var authenticate = lib.authenticate;

if (!process.argv[2]) {
  exitWithMsg('Usage example: git-apply-pr joyent/node#1337');
}

var ENABLE_PLUS_ONE = false;
var ownerRepoPrArg;
process.argv.slice(2).forEach(function(arg) {
  if (!/^\-\-/.test(arg)) {
    ownerRepoPrArg = arg;
    return;
  }
  if (/^\-\-plusone/.test(arg)) {
    ENABLE_PLUS_ONE = true;
    return;
  }
});

var ownerRepoPr = /(.*)\/(.*)#(\d*)/i.exec(ownerRepoPrArg);
if (!ownerRepoPr) {
  exitWithMsg('Usage example: git-apply-pr joyent/node#1337');
}

var prInfo = {
  OWNER: ownerRepoPr[1],
  REPO: ownerRepoPr[2],
  PR: +ownerRepoPr[3]
};

var config = {
  ENABLE_PLUS_ONE: ENABLE_PLUS_ONE,
  HOST: 'github.com'
};


if (typeof(prInfo.PR) !== 'number' || prInfo.PR < 1) {
  exitWithMsg('PR must be a positive number');
}

if (typeof(prInfo.OWNER) !== 'string' || prInfo.OWNER.length < 1) {
  exitWithMsg('OWNER must be a string');
}

if (typeof(prInfo.REPO) !== 'string' || prInfo.REPO.length < 1) {
  exitWithMsg('REPO must be a string');
}


// TODO XXX FIXME This should probably handle winders
var gitConfig = path.join(process.env.HOME, '.gitconfig');

if (fs.existsSync(gitConfig)) {

  var match = fs.readFileSync(gitConfig, 'utf8').match(/token\s*=\s*([a-f0-9]+)/);

  if (match) {
    authenticate(match[1]);
  }
}


getComments(prInfo, config, 1, resolveNames);
