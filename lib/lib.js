var util = require('util');
var os = require('os');
var assert = require('assert');

var Transform = require('stream').Transform;

var lstream = require('lstream');
var request = require('request');
var async = require('async');

var github = new (require('github'))({
  version: '3.0.0',
  headers: {
    'user-agent': 'git-apply-pr',
  },
});

function authenticate(token) {
  github.authenticate({
    type: 'token',
    token: token,
  });
}

exports.getComments = getComments;
function getComments(prInfo, config, page, next) {

  async.parallel({
    issues: function getIssueComments(cb) {
      github.issues.getComments({
        user: prInfo.OWNER,
        repo: prInfo.REPO,
        number: prInfo.PR,
        per_page: 100,
        page: page,
      }, cb);
    },
    pr: function getPrComments(cb) {
      github.pullRequests.getComments({
        user: prInfo.OWNER,
        repo: prInfo.REPO,
        number: prInfo.PR,
        per_page: 100,
        page: page,
      }, cb);
    }
  },
  function gotComments(err, comments) {
    if (err) {
      exitWithMsg(err);
    }

    var reviews = {};
    comments = comments.issues.concat(comments.pr);
    comments.forEach(function (comment) {
      if (/lgtm/i.test(comment.body) ||
          maybeTestForPlusOne(config, comment.body)) {
        var val = reviews[comment.user.login] || 0;
        reviews[comment.user.login] = val + 1;
      }
    });

    if (comments.length < 100)
      next(prInfo, config, reviews);
    else
      getComments(prInfo, config, page + 1, next);
  });
}

function maybeTestForPlusOne(config, comment) {
  if (!config.ENABLE_PLUS_ONE) {
    return false;
  }

  return /\+1/.test(comment);
}

exports.formatReviewedByMetaData = formatReviewedByMetaData;
function formatReviewedByMetaData(reviewer) {
  var formattedComponents = [];

  assert(typeof (reviewer.name) === 'string', 'reviewer name must be a string');

  formattedComponents.push(util.format('%s', reviewer.name));

  if (reviewer.email) {
    formattedComponents.push(util.format('<%s>', reviewer.email));
  }

  return formattedComponents.join(' ').trim();
}

function formatPRMetaData(prInfo) {
  return util.format('#%d', prInfo.PR);
}

function formatPRUrlMetaData(prInfo, config) {
  return util.format(
    'https://%s/%s/%s/pull/%d',
    config.HOST, prInfo.OWNER, prInfo.REPO, prInfo.PR
  );
}

exports.resolveNames = resolveNames;
function resolveNames(prInfo, config, reviews) {
  var queue = Object.keys(reviews);

  var result = [];

  function resolve(err, name) {
    if (err) {
      exitWithMsg(err);
    }

    result.push(formatReviewedByMetaData(name));

    if (result.length === queue.length)
      applyPatch(prInfo, config, result);
  }

  if (!queue.length) {
    exitWithMsg('this PR has not been LGTMd');
  }

  queue.forEach(function(name) {
    github.user.getFrom({ user: name }, resolve);
  });
}

exports.exitWithMsg = exitWithMsg;
function exitWithMsg(msg) {
  console.error(msg);
  process.exit(1);
}

function applyPatch(prInfo, config, reviews) {
  var mutator = new Mutator(prInfo, config, reviews);
  request({
    uri: formatPRUrlMetaData(prInfo, config) + '.patch',
    followAllRedirects: true
  })
  .pipe(new lstream()).pipe(mutator).pipe(process.stdout);
}

function Mutator(prInfo, config, reviews) {
  Transform.call(this, {
    decodeStrings: false,
    objectMode: true,
  });
  this.m_lineno = 0;
  this.m_message = [];
  this.m_state = 'UNKNOWN';

  this.reviews = reviews;
  this.config = config;
  this.prInfo = prInfo;
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

        var pr = formatPRMetaData(this.prInfo);
        this.m_message.push(util.format('PR: %s', pr));
        var prUrl = formatPRUrlMetaData(this.prInfo, this.config);
        this.m_message.push(util.format('PR-URL: %s', prUrl));

        var self = this;

        this.reviews.forEach(function(user) {
          self.m_message.push(util.format('Reviewed-By: %s', user));
        });

        this.m_message.push(chunk);

        this.push(this.m_message.join(os.EOL) + os.EOL);
        done();
        return;
      }
      break;
    case 'BODY':
      if (/^From /.test(chunk)) {
        // Process the next commit in this PR
        this.m_state = 'HEADER';
        this.m_message = [];
      } else {
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
