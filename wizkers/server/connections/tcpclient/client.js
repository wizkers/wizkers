/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2018 Edouard Lafargue, ed@wizkers.io
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
 *  Class for a Neutral TCP Client.
 * 
 * We kind of expect data to come in as JSON, but that's about it.
 *
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 *
 */

var net = require('net'),
    EventEmitter = require('events').EventEmitter,
    util = require('util'),
    debug = require('debug')('wizkers:connections:tcp-server:client');


//////////////////
// TCP Client
//////////////////

/**
 * Connection to TCP Clients
 *
 * @param   {Object}   sock the server socket
 */
var Client = function (sock) {

    EventEmitter.call(this);

    debug("Creating TCP client");
    // debug(sock);

    var self = this,
        token = undefined,
        lead_scout_id = undefined,
        cmd_id = 1,
        maxId = 255;


    sock.on('data', function(data) {
        var strdata = data.toString();
        //for (idx in strdata) {
            try {
                jsdata = JSON.parse(strdata);
            } catch (e) {
                console.log('Error parsing:', strdata);
                return;
            }

            debug(jsdata);

            self.emit('data', jsdata);
        //}
    });

    sock.on('close', function(data) {
        debug('Socket close', data);
    });

    sock.on('error', function(data) {
        debug('Socket error (will close)', data);
    });

    /**
     * The main role of this is to respawn the stream which
     * sometimes dies on us.
     * @param {String} error the error message
     */
    var handleError = function (error) {
        debug('Error on stream');
        debug(error);
    }


    /**
     * Send a command to a Scout. won't work if we send it before we know
     * the lead scout ID and token. Note: with the current way we use Scouts (only on Wifi),
     * this won't cover situations where we have several scouts per troop, since it will only
     * send commands to the lead scout.
     * @param {[[Type]]} cmd [[Description]]
     * @param {[[Type]]} cb  [[Description]]
     */
    this.sendCommand = function(cmd) {
        if (lead_scout_id != undefined && token != undefined) {
            sock.write('{"type":"command", "to":' + lead_scout_id + ', "id":"' + cmd_id++ + '",  "command":"' + cmd + '"}\n');
            if (cmd_id > maxId)
                cmd_id = 1;
        }
    };



    return this;
}

util.inherits(Client, EventEmitter);
module.exports = Client;