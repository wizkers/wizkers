/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2016 Edouard Lafargue, ed@wizkers.io
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software
 * is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
 * IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 *  Connection to devices connected through the Helium network
 *
 * Opens at create, sends 'data' events,
 * and 'status' events.
 *
 * Supports a "write" method.
 *
 * We do MSGPack conversions in here too, so that higher level
 * objects don't need to deal with anything else than Javascript.
 *
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 *
 */

var helium = require('helium'),
    EventEmitter = require('events').EventEmitter,
    util = require('util'),
    debug = require('debug')('wizkers:connections:helium');

var msgpack = require('msgpack5')() // namespace our extensions
  , encode  = msgpack.encode
  , decode  = msgpack.decode;

var Debug = false;

//////////////////
// Helium network interface:
//////////////////

// path is a helium JSON object with:
//  {mac: "HEX STRING", token: "base64 token" }
var HeliumConnection = function(path) {

    EventEmitter.call(this);
    var portOpen = false;
    var self = this;

    var token = path.token;
    var mac = path.mac;

    debug("Creating Helium object with the following info:");
    debug(path);
    var myHelium = new helium.Helium();

    this.open = function() {
        myHelium.open();

        debug("Starting subscription");
        myHelium.subscribe(mac, token);

        portOpen = true;
        debug('Port open');
        this.emit('status', {portopen: portOpen});

    };

    this.write = function(data) {
    }

    this.close = function(mac) {
        myHelium.unsubscribe(mac);
        myHelium.close();
        portOpen = false;
        self.emit('status', {portopen: portOpen});
    }


    // listen for new serial data:
   myHelium.on('message', function (data) {
        debug(data);
       var d2 = { mac: data.mac,
                 message: decode(data.message) }
        self.emit('data',d2);
   });

    return this;
}

util.inherits(HeliumConnection, EventEmitter);

module.exports = HeliumConnection;

