'use strict';

var SC = require('soundcloud');

var anchor;
var keys = 'protocol hostname host pathname port search hash href'.split(' ');
function _parseURL (url) {
    if (!anchor) {
        anchor = document.createElement('a');
    }
    anchor.href = url || '';
    var result = {}
    for (var i = 0, len = keys.length; i < len; i++) {
        var key = keys[i];
        result[key] = anchor[key];
    }
    return result;
}

function _appendQueryParam (url, param, value) {
    var U = _parseURL(url);
    var regex = /\?(?:.*)$/;
    var chr = regex.test(U.search) ? '&' : '?';
    var result = U.protocol + '//' +  U.host + U.port + U.pathname + U.search + chr + param + '=' + value + U.hash;
    return result;
}

function SoundCloud (clientId) {
    if (!(this instanceof SoundCloud)) {
        return new SoundCloud(clientId);
    }

    if (!clientId) {
        throw new Error('SoundCloud API clientId is required, get it - https://developers.soundcloud.com/');
    }

    this._events = {};

    this._clientId = clientId;
    this._baseUrl = 'https://api.soundcloud.com';

    this.playing = false;
    this.duration = 0;

    this.audio = document.createElement('audio');
    SC.initialize({
        client_id: clientId,
        redirect_uri: 'http://example.com/callback'
    });
}


SoundCloud.prototype.resolveUrl = function (url, callback) {
    if (!url) {
        throw new Error('SoundCloud track or playlist path is required');
    }


    SC.resolve(url).then( function(data) {
        console.log(data);
        this.cleanData();
        console.log(data);
        if (Array.isArray(data)) {
            var tracks = data;
            data = {tracks: tracks};
            this._playlist = data;
        } else if (data.tracks) {
            this._playlist = data;
        } else {
            this._track = data;

            // save timings
            var U = _parseURL(url);
            this._track.stream_url += U.hash;
        }
        console.log("got paste if else block")
        this.duration = data.duration && !isNaN(data.duration) ?
            data.duration / 1000 : // convert to seconds
            0; // no duration is zero
        console.log(data);
        callback(data);
    }.bind(this));
};

SoundCloud.prototype.resolve = function (url, callback) {
    if (!url) {
        throw new Error('SoundCloud track or playlist url is required');
    }

    var resolveUrl = this._baseUrl + '/resolve.json?url=' + encodeURIComponent(url) + '&client_id=' + this._clientId;
    this._json(resolveUrl, function (data) {
        this.cleanData();

        if (Array.isArray(data)) {
            var tracks = data;
            data = {tracks: tracks};
            this._playlist = data;
        } else if (data.tracks) {
            this._playlist = data;
        } else {
            this._track = data;

            // save timings
            var U = _parseURL(url);
            this._track.stream_url += U.hash;
        }

        this.duration = data.duration && !isNaN(data.duration) ?
            data.duration / 1000 : // convert to seconds
            0; // no duration is zero

        callback(data);
    }.bind(this));
};

SoundCloud.prototype._json = function (url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.setRequestHeader('DNT', ' ');
  xhr.open('GET', url);
  xhr.send(null);
  xhr.onreadystatechange = function () {
    var DONE = 4; // readyState 4 means the request is done.
    var OK = 200; // status 200 is a successful return.
    if (xhr.readyState === DONE) {
      if (xhr.status === OK) {
        callback(JSON.parse(xhr.responseText));
      } else {
        console.log('Error: ' + xhr.status); // An error occurred during the request.
      }
    }
  };
};

SoundCloud.prototype.on = function (e, fn) {
    this._events[e] = fn;
    this.audio.addEventListener(e, fn, false);
};

SoundCloud.prototype.off = function (e, fn) {
    this._events[e] = null;
    this.audio.removeEventListener(e, fn);
};

SoundCloud.prototype.unbindAll = function () {
    for (var e in this._events) {
        var fn = this._events[e];
        if (fn) {
            this.off(e, fn);
        }
    }
};

SoundCloud.prototype.preload = function (streamUrl) {
    this._track = {stream_url: streamUrl};
    this.audio.src = _appendQueryParam(streamUrl, 'client_id', this._clientId);
};

SoundCloud.prototype.play = function (options) {
    options = options || {};
    var src;

    if (options.streamUrl) {
        src = options.streamUrl;
    } else if (this._playlist) {
        var length = this._playlist.tracks.length;
        if (length) {
            this._playlistIndex = options.playlistIndex || 0;

            // be silent if index is out of range
            if (this._playlistIndex >= length || this._playlistIndex < 0) {
                this._playlistIndex = 0;
                return;
            }
            src = this._playlist.tracks[this._playlistIndex].stream_url;
        }
    } else if (this._track) {
        src = this._track.stream_url;
    }

    if (!src) {
        throw new Error('There is no tracks to play, use `streamUrl` option or `load` method');
    }

    src = _appendQueryParam(src, 'client_id', this._clientId);

    if (src !== this.audio.src) {
        this.audio.src = src;
    }

    this.playing = src;
    this.audio.play();
};

SoundCloud.prototype.pause = function () {
    this.audio.pause();
    this.playing = false;
};

SoundCloud.prototype.stop = function () {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.playing = false;
};

SoundCloud.prototype.next = function () {
    var tracksLength = this._playlist.tracks.length;
    if (this._playlistIndex >= tracksLength - 1) {
        return;
    }
    if (this._playlist && tracksLength) {
        this.play({playlistIndex: ++this._playlistIndex});
    }
};

SoundCloud.prototype.previous = function () {
    if (this._playlistIndex <= 0) {
        return;
    }
    if (this._playlist && this._playlist.tracks.length) {
        this.play({playlistIndex: --this._playlistIndex});
    }
};

SoundCloud.prototype.seek = function (e) {
    if (!this.audio.readyState) {
        return false;
    }
    var percent = e.offsetX / e.target.offsetWidth || (e.layerX - e.target.offsetLeft) / e.target.offsetWidth;
    this.audio.currentTime = percent * (this.audio.duration || 0);
};

SoundCloud.prototype.cleanData = function () {
    this._track = void 0;
    this._playlist = void 0;
};

module.exports = SoundCloud;
