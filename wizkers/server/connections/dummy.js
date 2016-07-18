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
 *  Dummy port connection
 *
 * Opens at create, sends random 'data' events,
 * and 'status' events.
 *
 * Supports a "write" method.
 *
 * At this point, this is just a simple wrapper around
 * serialport, it just gives us a bit of abstraction in
 * case we want to implement other kinds of connections/drivers
 * later on.
 *
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 *
 */

var EventEmitter = require('events').EventEmitter,
    util = require('util'),
    debug = require('debug')('wizkers:connections:dummy');

var Debug = false;

//////////////////
// Serial port interface:
//////////////////
var DummyConnection = function(path, settings) {

    EventEmitter.call(this);
    var self = this,
        time = null;

    debug("Opening dummy device at " + path);

    this.write = function(data) {
        debug('Port dummy write' + data);
    }

    this.close = function() {
        debug('Port dummy close');
        if (timer) {
           clearInterval(timer);
           timer = null;
        }
        this.emit('status', { portopen: false, error: false});
    }

    this.open = function () {
        // Confirm the port is open:
        this.emit('status', {portopen: true, error: false});
        // Start  a timer and send a random value between 0 and 100 every second
        timer = setInterval(output_random_data, 1000);
    }


    var output_random_data = function() {
        self.emit('data',
            { value: Math.random()*100 });
    };



    return this;
}

util.inherits(DummyConnection, EventEmitter);

module.exports = DummyConnection;

